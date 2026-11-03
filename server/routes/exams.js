const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Deterministic shuffle using student seed so each candidate gets a different question order
function shuffleForUser(array, seedStr = '') {
  const arr = [...array];
  if (!seedStr) seedStr = Math.random().toString();
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) % 2147483647;
  }
  function pseudoRandom() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(pseudoRandom() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Clean markdown bold, italics, code blocks, headers
function cleanMarkdown(str) {
  if (!str) return '';
  return str
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^#{1,6}\s*/, '')
    .trim();
}

// Ultra-robust AI & Text Question Parser supporting various formats: (a)/(b), Q1/Q2, numbers, markdown, inline indicators, or unnumbered blocks
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
            const cleanOpt = cleanMarkdown(opt).toLowerCase().trim();
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

  if (questions.length === 0) {
    questions.push({
      id: uuidv4(),
      questionText: rawText.slice(0, 150).trim(),
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctOptionIndex: 0,
      explanation: 'Auto-formatted question block.',
      revisionConcept: 'Team Knowledge'
    });
  }

  return questions;
}

// Call Google Gemini API to intelligently parse, solve, and verify question papers
async function parseWithGeminiApi(rawText, apiKey) {
  const prompt = `You are an expert examination processor and fact-checker. 
Carefully analyze the following raw question paper.
For every question:
1. Extract or clean the question prompt.
2. Extract exactly 4 distinct multiple-choice options (Option A, Option B, Option C, Option D).
3. Determine the 100% FACTUALLY AND LOGICALLY ACCURATE correct answer. If the text has an answer marked, verify it; if it does NOT have an answer marked, solve the question and identify the true correct option.
4. Set "correctOptionIndex" to 0 for Option A, 1 for Option B, 2 for Option C, or 3 for Option D.
5. Provide a clear technical explanation justifying why that option is correct.
6. Provide the relevant topic or revision concept.

Return ONLY a JSON array of objects with this exact schema:
[
  {
    "questionText": "string",
    "options": ["string", "string", "string", "string"],
    "correctOptionIndex": 0,
    "explanation": "string",
    "revisionConcept": "string"
  }
]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { text: `Raw Question Paper:\n${rawText}` }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) throw new Error('No output generated by Gemini');

  const parsed = JSON.parse(textOutput);
  const list = Array.isArray(parsed) ? parsed : (parsed.questions || Object.values(parsed)[0] || []);
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Gemini did not return an array of questions');
  }

  return list.map((q, idx) => {
    let options = Array.isArray(q.options) ? q.options.map(String) : [];
    while (options.length < 4) options.push(`Option ${String.fromCharCode(65 + options.length)}`);
    options = options.slice(0, 4);

    const rawIdx = parseInt(q.correctOptionIndex, 10);
    const validIdx = (Number.isInteger(rawIdx) && rawIdx >= 0 && rawIdx < 4) ? rawIdx : 0;

    return {
      id: uuidv4(),
      questionText: String(q.questionText || `Question ${idx + 1}`).trim(),
      options,
      correctOptionIndex: validIdx,
      explanation: String(q.explanation || 'Factually verified by Gemini AI.').trim(),
      revisionConcept: String(q.revisionConcept || 'General Knowledge').trim()
    };
  });
}

// Call OpenAI API to intelligently parse, solve, and verify question papers
async function parseWithOpenAiApi(rawText, apiKey) {
  const prompt = `You are an expert examination processor.
Analyze the following raw question paper.
For each question:
1. Extract the question prompt.
2. Provide exactly 4 options.
3. Solve the question and determine the 100% factually correct answer (0 for A, 1 for B, 2 for C, 3 for D).
4. Provide a technical explanation and revision concept.
Return a JSON array of objects with keys: questionText, options (array of 4 strings), correctOptionIndex (0-3), explanation, revisionConcept.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: rawText }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content);
  const list = Array.isArray(parsed) ? parsed : (parsed.questions || Object.values(parsed)[0] || []);

  return list.map((q, idx) => {
    let options = Array.isArray(q.options) ? q.options.map(String) : [];
    while (options.length < 4) options.push(`Option ${String.fromCharCode(65 + options.length)}`);
    options = options.slice(0, 4);

    const rawIdx = parseInt(q.correctOptionIndex, 10);
    const validIdx = (Number.isInteger(rawIdx) && rawIdx >= 0 && rawIdx < 4) ? rawIdx : 0;

    return {
      id: uuidv4(),
      questionText: String(q.questionText || `Question ${idx + 1}`).trim(),
      options,
      correctOptionIndex: validIdx,
      explanation: String(q.explanation || 'Factually verified by OpenAI.').trim(),
      revisionConcept: String(q.revisionConcept || 'General Knowledge').trim()
    };
  });
}

// POST /api/exams/ai-parse - Bulk paste questions & intelligent auto-formatter
router.post('/ai-parse', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rawText, apiKey } = req.body;
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
      return res.status(400).json({ error: 'Please provide raw questions text to parse.' });
    }

    const effectiveGeminiKey = apiKey || process.env.GEMINI_API_KEY;
    const effectiveOpenAiKey = apiKey || process.env.OPENAI_API_KEY;

    let questions = [];
    let provider = 'offline_parser';

    if (effectiveGeminiKey && !effectiveGeminiKey.startsWith('sk-')) {
      try {
        questions = await parseWithGeminiApi(rawText, effectiveGeminiKey);
        provider = 'gemini_ai';
      } catch (geminiErr) {
        console.warn('Gemini API parse failed, falling back to local parser:', geminiErr.message);
        questions = parseAiQuestionsText(rawText);
      }
    } else if (effectiveOpenAiKey && effectiveOpenAiKey.startsWith('sk-')) {
      try {
        questions = await parseWithOpenAiApi(rawText, effectiveOpenAiKey);
        provider = 'openai_ai';
      } catch (openAiErr) {
        console.warn('OpenAI API parse failed, falling back to local parser:', openAiErr.message);
        questions = parseAiQuestionsText(rawText);
      }
    } else {
      questions = parseAiQuestionsText(rawText);
    }

    res.json({
      success: true,
      provider,
      count: questions.length,
      questions
    });
  } catch (err) {
    console.error('AI question parse error:', err);
    res.status(500).json({ error: 'Failed to parse raw questions text.' });
  }
});

// GET /api/exams - List available exams for students
router.get('/', authenticateToken, async (req, res) => {
  try {
    const allExams = await db.Exams.find({ status: 'published' });
    
    // Check if current user has completed attempts for these exams
    const userAttempts = await db.Attempts.find({ userId: req.user.id });
    
    const formatted = allExams.map(exam => {
      const attempt = userAttempts.find(a => a.examId === exam._id);
      return {
        _id: exam._id,
        title: exam.title,
        code: exam.code,
        subject: exam.subject,
        description: exam.description,
        durationMinutes: exam.durationMinutes,
        questionsCount: exam.questions ? exam.questions.length : 0,
        marksPerQuestion: exam.marksPerQuestion,
        negativeMarkPerQuestion: exam.negativeMarkPerQuestion,
        totalMarks: (exam.questions ? exam.questions.length : 0) * (exam.marksPerQuestion || 4),
        violationThreshold: exam.violationThreshold || 3,
        answerKeyRelease: exam.answerKeyRelease || 'immediate',
        isLive: Boolean(exam.isLive),
        userAttempt: attempt ? {
          attemptId: attempt._id,
          status: attempt.status,
          score: attempt.score,
          percentage: attempt.percentage,
          submittedAt: attempt.submittedAt
        } : null
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Fetch exams error:', err);
    res.status(500).json({ error: 'Failed to retrieve available exams.' });
  }
});

// GET /api/exams/admin/all - Admin exam management list
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const allExams = await db.Exams.find();
    res.json(allExams);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admin exam repository.' });
  }
});

// GET /api/exams/:id - Get student exam interface (SANITIZED - ALLOCATED UNIQUELY PER PERSON)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const exam = await db.Exams.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ error: 'Examination protocol not found.' });
    }

    // Check if user has an attempt with saved question order; otherwise shuffle based on candidate user ID
    let rawQuestions = [...(exam.questions || [])];
    const attempt = await db.Attempts.findOne({
      userId: req.user.id,
      examId: req.params.id
    });

    if (attempt && Array.isArray(attempt.questionOrder) && attempt.questionOrder.length > 0) {
      const qMap = new Map(rawQuestions.map(q => [q.id, q]));
      const ordered = [];
      for (const qid of attempt.questionOrder) {
        if (qMap.has(qid)) ordered.push(qMap.get(qid));
      }
      for (const q of rawQuestions) {
        if (!attempt.questionOrder.includes(q.id)) ordered.push(q);
      }
      rawQuestions = ordered;
    } else {
      // Allocate differently from person to person using candidate ID seed
      rawQuestions = shuffleForUser(rawQuestions, req.user.id);
    }

    // Sanitize questions to protect answer keys
    const sanitizedQuestions = rawQuestions.map((q, idx) => ({
      id: q.id || `q_${idx}`,
      questionText: q.questionText,
      options: q.options
      // OMIT correctOptionIndex, explanation, revisionConcept
    }));

    res.json({
      _id: exam._id,
      title: exam.title,
      code: exam.code,
      subject: exam.subject,
      description: exam.description,
      durationMinutes: exam.durationMinutes,
      marksPerQuestion: exam.marksPerQuestion,
      negativeMarkPerQuestion: exam.negativeMarkPerQuestion,
      violationThreshold: 1, // Strict 1-infraction block as requested
      instructions: exam.instructions || [],
      questions: sanitizedQuestions,
      answerKeyRelease: exam.answerKeyRelease
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve examination content.' });
  }
});

// GET /api/exams/:id/full - Admin inspect exam with answers
router.get('/:id/full', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const exam = await db.Exams.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found.' });
    }
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch full exam specification.' });
  }
});

// POST /api/exams - Create new exam (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      title,
      code,
      subject,
      description,
      durationMinutes,
      marksPerQuestion,
      negativeMarkPerQuestion,
      violationThreshold,
      answerKeyRelease,
      instructions,
      questions
    } = req.body;

    if (!title || !subject || !durationMinutes || !questions || questions.length === 0) {
      return res.status(400).json({ error: 'Title, subject, duration, and at least one question are required.' });
    }

    const validatedQuestions = questions.map((q, i) => {
      const rawIdx = parseInt(q.correctOptionIndex, 10);
      const validIdx = (Number.isInteger(rawIdx) && rawIdx >= 0 && rawIdx < (q.options ? q.options.length : 4)) ? rawIdx : 0;
      return {
        id: q.id || uuidv4(),
        questionText: q.questionText,
        options: q.options,
        correctOptionIndex: validIdx,
        explanation: q.explanation || 'No rationale provided.',
        revisionConcept: q.revisionConcept || subject
      };
    });

    const newExam = await db.Exams.create({
      title: title.trim(),
      code: code ? code.trim() : `IRIS-${Math.floor(100 + Math.random() * 900)}`,
      subject: subject.trim(),
      description: description || '',
      durationMinutes: Number(durationMinutes),
      marksPerQuestion: Number(marksPerQuestion) || 4,
      negativeMarkPerQuestion: Number(negativeMarkPerQuestion) || 0,
      violationThreshold: Number(violationThreshold) || 3,
      answerKeyRelease: answerKeyRelease || 'immediate',
      status: 'published',
      instructions: instructions || [
        'Complete all questions within the allocated time.',
        'Fullscreen mode is required and monitored.',
        'Browser tab switching or exiting will trigger violation strikes.'
      ],
      questions: validatedQuestions,
      createdBy: req.user.name
    });

    res.status(201).json(newExam);
  } catch (err) {
    console.error('Create exam error:', err);
    res.status(500).json({ error: 'Failed to create examination protocol.' });
  }
});

// PUT /api/exams/:id - Update exam (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const existing = await db.Exams.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Exam not found.' });
    }

    const updated = await db.Exams.updateOne(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update examination protocol.' });
  }
});

// DELETE /api/exams/:id - Delete exam (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const success = await db.Exams.deleteOne(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Exam not found.' });
    }
    res.json({ message: 'Exam protocol removed from database.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete exam.' });
  }
});

// PATCH /api/exams/:id/toggle-release - Toggle or release answer key
router.patch('/:id/toggle-release', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const exam = await db.Exams.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found.' });
    }

    const currentMode = exam.answerKeyRelease || 'immediate';
    const nextMode = currentMode === 'immediate' ? 'admin_released' : 'immediate';
    const updated = await db.Exams.updateOne(req.params.id, { answerKeyRelease: nextMode });
    res.json({ message: `Answer key status updated to: ${nextMode}`, exam: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update answer key release state.' });
  }
});

// Helper function: calculate score for submitted attempts
function calculateAttemptScore(exam, answers) {
  const questions = exam.questions || [];
  const marksPerQ = Number(exam.marksPerQuestion) || 4;
  const negMark = Number(exam.negativeMarkPerQuestion) || 0;
  const maxMarks = questions.length * marksPerQ;

  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  questions.forEach(q => {
    const userChoice = answers[q.id];
    if (userChoice === undefined || userChoice === null) {
      unansweredCount++;
    } else if (Number(userChoice) === Number(q.correctOptionIndex)) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  });

  const rawScore = (correctCount * marksPerQ) - (incorrectCount * negMark);
  const score = Math.max(0, Math.round(rawScore * 100) / 100);
  const percentage = maxMarks > 0 ? Math.round((score / maxMarks) * 1000) / 10 : 0;
  const attempted = correctCount + incorrectCount;
  const accuracy = attempted > 0 ? Math.round((correctCount / attempted) * 1000) / 10 : 0;

  return {
    score,
    maxMarks,
    percentage,
    accuracy,
    correctCount,
    incorrectCount,
    unansweredCount
  };
}

// POST /api/exams/start-latest - Start the most recent exam for the team
router.post('/start-latest', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const exams = await db.Exams.find();
    if (!exams || exams.length === 0) {
      return res.status(400).json({ error: 'No examination found. Please create questions first.' });
    }
    const latestExam = exams[exams.length - 1];
    const updatedExam = await db.Exams.updateOne(latestExam._id, { isLive: true, startedAt: new Date().toISOString() });
    
    const io = req.app.get('io');
    if (io) {
      io.emit('quiz_live_started', {
        examId: latestExam._id,
        title: latestExam.title,
        durationMinutes: latestExam.durationMinutes,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: `Quiz "${latestExam.title}" is now LIVE for all team members!`, exam: updatedExam });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start quiz.' });
  }
});

// POST /api/exams/stop-latest - Stop the live exam, auto-submit all candidates' answers and lock them
router.post('/stop-latest', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const exams = await db.Exams.find();
    if (!exams || exams.length === 0) {
      return res.status(400).json({ error: 'No examination found.' });
    }
    // Set all live exams to stopped
    for (const ex of exams.filter(e => e.isLive)) {
      await db.Exams.updateOne(ex._id, { isLive: false, stoppedAt: new Date().toISOString() });
    }
    // Target exam
    const liveExam = exams.slice().reverse().find(e => e.isLive) || exams[exams.length - 1];
    const updatedExam = await db.Exams.updateOne(liveExam._id, { isLive: false, stoppedAt: new Date().toISOString() });

    // Find all in-progress attempts for this exam (or any in_progress attempt) and auto-submit them with whatever answers they have attempted
    const allAttempts = await db.Attempts.find({ status: 'in_progress' });
    let autoSubmittedCount = 0;

    for (const attempt of allAttempts) {
      const examForAttempt = exams.find(e => e._id === attempt.examId) || liveExam;
      const scoreResult = calculateAttemptScore(examForAttempt, attempt.answers || {});
      await db.Attempts.updateOne(attempt._id, {
        status: 'submitted',
        stoppedByAdmin: true,
        submittedAt: new Date().toISOString(),
        score: scoreResult.score,
        percentage: scoreResult.percentage,
        accuracy: scoreResult.accuracy,
        correctCount: scoreResult.correctCount,
        incorrectCount: scoreResult.incorrectCount,
        unansweredCount: scoreResult.unansweredCount
      });
      autoSubmittedCount++;
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('quiz_stopped', {
        examId: liveExam._id,
        title: liveExam.title,
        message: 'The examination has been concluded by the Administrator. All attempted answers have been automatically finalized and submitted.'
      });
      io.to('admin_room').emit('exam_submitted', { stoppedByAdmin: true, count: autoSubmittedCount });
    }

    res.json({ 
      success: true, 
      message: `Quiz "${liveExam.title}" has been STOPPED. ${autoSubmittedCount} candidate attempts submitted automatically.`,
      autoSubmittedCount,
      exam: updatedExam 
    });
  } catch (err) {
    console.error('Stop quiz error:', err);
    res.status(500).json({ error: 'Failed to stop quiz.' });
  }
});

// POST /api/exams/:id/start-quiz - Start specific exam
router.post('/:id/start-quiz', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const exam = await db.Exams.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: 'Exam not found.' });

    await db.Exams.updateOne(req.params.id, { isLive: true, startedAt: new Date().toISOString() });

    const io = req.app.get('io');
    if (io) {
      io.emit('quiz_live_started', {
        examId: exam._id,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: `Quiz "${exam.title}" is now LIVE for all team members!`, exam });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start quiz.' });
  }
});

// POST /api/exams/:id/stop-quiz - Stop specific exam
router.post('/:id/stop-quiz', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const exam = await db.Exams.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: 'Exam not found.' });

    await db.Exams.updateOne(req.params.id, { isLive: false, stoppedAt: new Date().toISOString() });

    const allAttempts = await db.Attempts.find({ examId: req.params.id, status: 'in_progress' });
    let autoSubmittedCount = 0;

    for (const attempt of allAttempts) {
      const scoreResult = calculateAttemptScore(exam, attempt.answers || {});
      await db.Attempts.updateOne(attempt._id, {
        status: 'submitted',
        stoppedByAdmin: true,
        submittedAt: new Date().toISOString(),
        score: scoreResult.score,
        percentage: scoreResult.percentage,
        accuracy: scoreResult.accuracy,
        correctCount: scoreResult.correctCount,
        incorrectCount: scoreResult.incorrectCount,
        unansweredCount: scoreResult.unansweredCount
      });
      autoSubmittedCount++;
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('quiz_stopped', {
        examId: exam._id,
        title: exam.title,
        message: 'The examination has been concluded by the Administrator. All attempted answers have been automatically finalized and submitted.'
      });
      io.to('admin_room').emit('exam_submitted', { stoppedByAdmin: true, count: autoSubmittedCount });
    }

    res.json({ 
      success: true, 
      message: `Quiz "${exam.title}" has been STOPPED. ${autoSubmittedCount} candidate attempts submitted automatically.`,
      autoSubmittedCount,
      exam 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop quiz.' });
  }
});

module.exports = router;
