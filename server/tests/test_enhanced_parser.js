const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Clean markdown bold, italics, code blocks
function cleanMarkdown(str) {
  if (!str) return '';
  return str
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^#{1,6}\s*/, '')
    .trim();
}

// Ultra-robust AI & Text Question Parser
function parseAiQuestionsText(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return [];

  // 1. Normalize line breaks
  let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // 2. Pre-scan for Answer Key block at end of text (e.g., "Answer Key:\n1. B\n2. C")
  const answerKeyMap = {};
  const answerKeyRegex = /\n(?:(?:Answer\s*Key|Answers|Solutions|Keys|Correct\s*Answers)\s*[:=-]*\s*\n)([\s\S]+)$/i;
  const keyMatch = text.match(answerKeyRegex);
  if (keyMatch) {
    const keyBlock = keyMatch[1];
    text = text.slice(0, keyMatch.index).trim(); // Remove answer key block from questions text

    // Parse each line or comma-separated item in answer key block
    const keyLines = keyBlock.split('\n');
    for (const kl of keyLines) {
      // Matches "1. B", "1) (b)", "Q1: B", "1 - Option B", "1: B"
      const pairMatches = kl.matchAll(/(?:(?:Q|Question\s*)?(\d+)[\s.:)-]+(?:Option\s*)?\(?([A-Da-d1-4])\)?)/gi);
      for (const m of pairMatches) {
        const qNum = parseInt(m[1], 10);
        const ansChar = m[2].toUpperCase();
        const map = { 'A': 0, '1': 0, 'B': 1, '2': 1, 'C': 2, '3': 2, 'D': 3, '4': 3 };
        if (map[ansChar] !== undefined) {
          answerKeyMap[qNum] = map[ansChar];
        }
      }
    }
  }

  // 3. Handle inline options on single line: "A) London  B) Paris  C) Rome  D) Berlin"
  // Note: Only match if preceding char is not a bullet point (- or * or +)
  text = text.replace(/([^\n\-*+•\s])\s+([(\[]?[B-Db-d2-4][)\]][.:\s-]+|[B-Db-d2-4]\.\s+)/g, '$1\n$2');

  const lines = text.split('\n');
  const questions = [];
  let currentQ = null;

  function finalizeCurrentQ() {
    if (currentQ && currentQ.questionText && currentQ.questionText.trim()) {
      while (currentQ.options.length < 4) {
        currentQ.options.push('Option ' + String.fromCharCode(65 + currentQ.options.length));
      }
      currentQ.options = currentQ.options.slice(0, 4);

      let finalCorrectIdx = 0;

      // 1. Direct matched index from answer line or inline indicator
      if (typeof currentQ.correctOptionIndex === 'number' && currentQ.correctOptionIndex >= 0 && currentQ.correctOptionIndex < currentQ.options.length) {
        finalCorrectIdx = currentQ.correctOptionIndex;
      }
      // 2. Answer text matching (e.g. "Answer: Paris" or "Answer: B) Paris")
      else if (currentQ.rawAnswerText) {
        const raw = currentQ.rawAnswerText.toLowerCase().replace(/^[a-d1-4][.:)\s-]+/i, '').trim();
        if (raw.length >= 2) {
          // Exact or substring match of full option text
          const foundIdx = currentQ.options.findIndex(opt => {
            const cleanOpt = opt.toLowerCase().trim();
            return cleanOpt === raw || cleanOpt.startsWith(raw) || raw.startsWith(cleanOpt);
          });
          if (foundIdx !== -1) {
            finalCorrectIdx = foundIdx;
          }
        }
      }

      // Clean option text markdown
      const cleanedOptions = currentQ.options.map(opt => cleanMarkdown(opt).replace(/^[*•\-+]\s*/, '').trim());

      questions.push({
        id: uuidv4(),
        questionText: cleanMarkdown(currentQ.questionText).trim(),
        options: cleanedOptions,
        correctOptionIndex: finalCorrectIdx,
        explanation: cleanMarkdown(currentQ.explanation).trim() || 'No technical explanation provided.',
        revisionConcept: cleanMarkdown(currentQ.revisionConcept).trim() || 'General Knowledge'
      });
    }
  }

  for (let rawLine of lines) {
    const rawTrimmed = rawLine.trim();
    if (!rawTrimmed) continue;

    // Cleaned version for header checking
    const line = cleanMarkdown(rawTrimmed);
    if (!line) continue;

    // 1. Answer indicator
    // Matches:
    // "Answer: B", "Ans: (b)", "Correct Answer: C", "Correct Option is: D", "Key: A", "Right Ans: 3"
    // "Answer: Option B", "Ans: option (c)", "Answer: B) Paris", "Correct: B"
    const ansMatch = line.match(/^(?:(?:[Cc]orrect\s*(?:[Aa]nswer|[Oo]ption)?|[Aa]nswer|[Aa]ns|[Kk]ey|[Ss]olution|[Rr]ight\s*[Aa]nswer)\s*(?:is|:|=|-|\.)*\s*)(?:[Oo]ption\s*)?\(?([A-Da-d1-4])\)?(?:\.|\s|:|-|$)(.*)/i);
    if (ansMatch && currentQ) {
      const char = ansMatch[1].toUpperCase();
      const map = { 'A': 0, '1': 0, 'B': 1, '2': 1, 'C': 2, '3': 2, 'D': 3, '4': 3 };
      currentQ.correctOptionIndex = map[char] !== undefined ? map[char] : 0;
      if (ansMatch[2] && ansMatch[2].trim()) {
        currentQ.rawAnswerText = ansMatch[2].trim();
      }
      continue;
    }

    // Answer by option text: e.g. "Answer: Resection method"
    const textAnsMatch = line.match(/^(?:(?:[Cc]orrect\s*(?:[Aa]nswer|[Oo]ption)?|[Aa]nswer|[Aa]ns|[Kk]ey|[Ss]olution)\s*(?:is|:|=|-|\.)*\s*)(.+)/i);
    if (textAnsMatch && currentQ && currentQ.options.length > 0) {
      const ansTarget = cleanMarkdown(textAnsMatch[1]).trim().toLowerCase();
      // Check if target starts with "option B" or "(B)"
      const optLetterMatch = ansTarget.match(/^(?:option\s*)?\(?([a-d1-4])\)?(?:\.|\s|$)/i);
      if (optLetterMatch) {
        const char = optLetterMatch[1].toUpperCase();
        const map = { 'A': 0, '1': 0, 'B': 1, '2': 1, 'C': 2, '3': 2, 'D': 3, '4': 3 };
        if (map[char] !== undefined) {
          currentQ.correctOptionIndex = map[char];
          continue;
        }
      }
      // Check if ansTarget matches any option text directly
      const foundIdx = currentQ.options.findIndex(opt => {
        const cleanOpt = cleanMarkdown(opt).toLowerCase().trim();
        return cleanOpt === ansTarget || cleanOpt.startsWith(ansTarget) || ansTarget.startsWith(cleanOpt);
      });
      if (foundIdx !== -1) {
        currentQ.correctOptionIndex = foundIdx;
        continue;
      }
    }

    // 2. Explanation / Concept / Reason
    const expMatch = line.match(/^(?:(?:[Ee]xplanation|[Rr]ationale|[Nn]ote|[Rr]eason)\s*(?:is|:|=|-|\.)*\s*)(.*)/i);
    if (expMatch && currentQ) {
      currentQ.explanation = expMatch[1].trim();
      continue;
    }
    const conceptMatch = line.match(/^(?:(?:[Cc]oncept|[Tt]opic|[Rr]evise)\s*(?:is|:|=|-|\.)*\s*)(.*)/i);
    if (conceptMatch && currentQ) {
      currentQ.revisionConcept = conceptMatch[1].trim();
      continue;
    }

    // 3. Option line (A-D or paren/bracket/bullet numbered 1-4, or 2-4 if options already started):
    // Matches: "A. ...", "A) ...", "(A) ...", "[A] ...", "- A. ...", "* A) ...", "• (A) ..."
    // Or numbered options: "1) ...", "(1) ...", "[1] ...", "- 1. ...", or "2. ...", "3. ...", "4. ..."
    let optMatch = line.match(/^(?:[*•\-+]\s*)?(?:(?:\(?([A-Da-d])\)?[.:\s-]+)|(?:\[([A-Da-d])\][\s.:-]*))(.*)/);
    if (!optMatch && currentQ && currentQ.options.length < 4) {
      if (currentQ.options.length === 0) {
        // First option with number: require paren/bracket/bullet, e.g. "1)", "(1)", "[1]", "- 1."
        optMatch = line.match(/^(?:(?:[*•\-+]\s+(?:1[.:)\s-]))|(?:(?:\(?1\)[.:\s-]*)|(?:\[1\][\s.:-]*)))(.*)/);
        if (optMatch) optMatch = [optMatch[0], '1', undefined, optMatch[1]];
      } else {
        // Subsequent options: "2.", "2)", "(2)", "[2]", etc.
        const nextNum = currentQ.options.length + 1;
        const numRegex = new RegExp(`^(?:[*•\\-+Found]\\s*)?(?:(?:\\(?(${nextNum})\\)?[.:\\s-]+)|(?:\\[(${nextNum})\\][\\s.:-]*))(.*)`);
        optMatch = line.match(numRegex);
      }
    }

    if (optMatch && currentQ) {
      const optLetter = (optMatch[1] || optMatch[2] || 'A').toUpperCase();
      let optText = (optMatch[3] !== undefined ? optMatch[3] : '').trim();

      // Check if option line has an inline correctness indicator:
      const isMarkedCorrect = /\((?:correct|answer|ans|right)\)/i.test(optText) ||
                              /\[(?:correct|answer|ans|right)\]/i.test(optText) ||
                              /^[✓✔]\s*/.test(optText) ||
                              /\s*[✓✔]$/.test(optText) ||
                              /^[✓✔]\s*/.test(rawTrimmed) ||
                              /^\*\s+[A-Da-d1-4]/.test(rawTrimmed) ||
                              /[^*]\*\s*$/.test(rawTrimmed) ||
                              /\[x\]/i.test(rawTrimmed) ||
                              /\(x\)/i.test(rawTrimmed);

      if (isMarkedCorrect) {
        currentQ.correctOptionIndex = currentQ.options.length;
        optText = optText
          .replace(/\((?:correct|answer|ans|right)\)/gi, '')
          .replace(/\[(?:correct|answer|ans|right)\]/gi, '')
          .replace(/[✓✔]/g, '')
          .replace(/\s*\*+\s*$/, '')
          .trim();
      }

      currentQ.options.push(optText || ('Option ' + optLetter));
      continue;
    }

    // 4. Question start: "Q1. ...", "1. ...", "Question 1: ...", "### 1. ...", "1) ..."
    const qMatch = line.match(/^(?:(?:[Qq]uestion\s*\d+|Q\d+|\d+)[\s.:)-]+)(.+)/i);
    if (qMatch) {
      finalizeCurrentQ();
      currentQ = {
        questionText: qMatch[1].trim(),
        options: [],
        correctOptionIndex: null,
        rawAnswerText: null,
        explanation: '',
        revisionConcept: ''
      };
      continue;
    }

    // If no active question, current line starts the first question
    if (!currentQ) {
      currentQ = {
        questionText: line,
        options: [],
        correctOptionIndex: null,
        rawAnswerText: null,
        explanation: '',
        revisionConcept: ''
      };
      continue;
    }

    // If current question already has at least 2 options and next line is not an option or answer, it's a new question!
    if (currentQ.options.length >= 2 && !optMatch && !ansMatch && !textAnsMatch) {
      finalizeCurrentQ();
      currentQ = {
        questionText: line,
        options: [],
        correctOptionIndex: null,
        rawAnswerText: null,
        explanation: '',
        revisionConcept: ''
      };
      continue;
    }

    // Otherwise append to questionText or explanation
    if (currentQ.options.length === 0) {
      currentQ.questionText += ' ' + line;
    } else {
      currentQ.explanation = (currentQ.explanation ? currentQ.explanation + ' ' : '') + line;
    }
  }

  finalizeCurrentQ();

  // If answerKeyMap has entries, assign to any questions that didn't have answers inline
  if (Object.keys(answerKeyMap).length > 0) {
    questions.forEach((q, idx) => {
      const qNum = idx + 1;
      if (answerKeyMap[qNum] !== undefined) {
        q.correctOptionIndex = answerKeyMap[qNum];
      }
    });
  }

  return questions;
}

// -------------------------------------------------------------
// Comprehensive Test Suite with Real World Formats
// -------------------------------------------------------------
const testCases = [
  {
    name: '1. Standard Answer: B',
    input: `1. What is the primary function of an operating system?
A. Compiling source code
B. Managing hardware and software resources
C. Designing graphic user interfaces
D. Browsing the internet
Answer: B`,
    expectedCorrect: 1
  },
  {
    name: '2. Answer: Option B',
    input: `1. What is the primary function of an operating system?
A. Compiling source code
B. Managing hardware and software resources
C. Designing graphic user interfaces
D. Browsing the internet
Answer: Option B`,
    expectedCorrect: 1
  },
  {
    name: '3. ChatGPT Markdown **Answer:** **B**',
    input: `1. Which protocol provides encrypted communication?
A. HTTP
B. HTTPS
C. FTP
D. Telnet
**Answer:** **B**`,
    expectedCorrect: 1
  },
  {
    name: '4. ChatGPT Markdown with bold options & Answer: **C**',
    input: `1. Choose the capital of Italy:
A. **London**
B. **Paris**
C. **Rome**
D. **Berlin**
**Answer:** **C**`,
    expectedCorrect: 2
  },
  {
    name: '5. Markdown bullet options with Answer: D',
    input: `Question 1. What port is used by HTTPS?
- A) 80
- B) 21
- C) 25
- D) 443
Answer: Option D`,
    expectedCorrect: 3
  },
  {
    name: '6. Inline (Correct) indicator on Option B',
    input: `1. Which planet is closest to the Sun?
A. Venus
B. Mercury (Correct)
C. Earth
D. Mars`,
    expectedCorrect: 1
  },
  {
    name: '7. Inline [Correct] indicator on Option C',
    input: `1. Which planet is known as the Red Planet?
A. Venus
B. Jupiter
C. Mars [Correct]
D. Saturn`,
    expectedCorrect: 2
  },
  {
    name: '8. Inline checkmark indicator on Option A',
    input: `1. Which gas do plants primarily absorb?
✓ A. Carbon dioxide
B. Oxygen
C. Nitrogen
D. Helium`,
    expectedCorrect: 0
  },
  {
    name: '9. Answer with full text matching',
    input: `1. Which is the fastest terrestrial animal?
A. Lion
B. Cheetah
C. Gazelle
D. Leopard
Answer: Cheetah`,
    expectedCorrect: 1
  },
  {
    name: '10. Numbered options 1, 2, 3, 4 with Answer: 3',
    input: `1. What is the chemical formula for water?
1) CO2
2) NaCl
3) H2O
4) CH4
Answer: 3`,
    expectedCorrect: 2
  },
  {
    name: '11. Answer Key at end of document',
    input: `1. What is 2 + 2?
A. 3
B. 4
C. 5
D. 6

2. What is 5 x 5?
A. 20
B. 30
C. 25
D. 10

Answer Key:
1. B
2. C`,
    expectedResults: [1, 2]
  },
  {
    name: '12. Correct Option is: B',
    input: `1. What is the speed of light approx?
A. 150,000 km/s
B. 300,000 km/s
C. 450,000 km/s
D. 600,000 km/s
Correct Option is: B`,
    expectedCorrect: 1
  },
  {
    name: '13. Option B marked with trailing asterisk',
    input: `1. What is the SI unit of force?
A. Joule
B. Newton *
C. Watt
D. Pascal`,
    expectedCorrect: 1
  },
  {
    name: '14. Options on single line',
    input: `1. What is the square root of 64?
A) 6  B) 7  C) 8  D) 9
Answer: C`,
    expectedCorrect: 2
  },
  {
    name: '15. Lowercase options and lowercase answer',
    input: `1. Which protocol runs on port 22?
a) FTP
b) SSH
c) Telnet
d) SMTP
ans: b`,
    expectedCorrect: 1
  },
  {
    name: '16. Equal sign & dash answer indicators',
    input: `1. Value of pi is ~3.14?
A. No
B. Yes
C. Maybe
D. Never
Answer = B`,
    expectedCorrect: 1
  },
  {
    name: '17. Multi-line explanation and concept',
    input: `1. What is AES?
A. Symmetric encryption
B. Asymmetric encryption
C. Hash function
D. Encoding
Answer: A
Explanation: Advanced Encryption Standard is a symmetric cipher.
It uses block size of 128 bits.
Concept: Cryptography`,
    expectedCorrect: 0
  },
  {
    name: '18. Option B with (Ans) indicator',
    input: `1. What is DNS?
A. Domain Name System (Ans)
B. Direct Network Source
C. Domain Node Service
D. Data Network Storage`,
    expectedCorrect: 0
  }
];

console.log('=== RUNNING ENHANCED QUESTION PARSER TESTS ===\n');
let passed = 0;
let total = 0;

for (const tc of testCases) {
  total++;
  const res = parseAiQuestionsText(tc.input);

  if (tc.expectedResults) {
    const actuals = res.map(q => q.correctOptionIndex);
    const isPass = JSON.stringify(actuals) === JSON.stringify(tc.expectedResults) && res.length === tc.expectedResults.length;
    console.log(`[${isPass ? 'PASS' : 'FAIL'}] ${tc.name}`);
    console.log(`       Got: [${actuals.join(', ')}] (Length: ${res.length}), Expected: [${tc.expectedResults.join(', ')}]`);
    if (isPass) passed++;
  } else {
    const actual = res[0] ? res[0].correctOptionIndex : -1;
    const isPass = actual === tc.expectedCorrect;
    console.log(`[${isPass ? 'PASS' : 'FAIL'}] ${tc.name}`);
    console.log(`       Got: Option ${String.fromCharCode(65 + actual)} (${actual}), Expected: Option ${String.fromCharCode(65 + tc.expectedCorrect)} (${tc.expectedCorrect})`);
    if (!isPass) {
      console.log('       DEBUG res:', JSON.stringify(res, null, 2));
    }
    if (isPass) passed++;
  }
}

console.log(`\nRESULTS: ${passed}/${total} test cases passed.`);
if (passed === total) {
  console.log('ALL TESTS PASSED WITH 100% ACCURACY!');
} else {
  process.exit(1);
}
