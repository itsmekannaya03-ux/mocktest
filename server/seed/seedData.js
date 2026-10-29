const bcrypt = require('bcryptjs');
const db = require('../models/db');

async function seedDatabase() {
  const existingUsers = await db.Users.find();
  if (existingUsers.length === 0) {
    console.log('[Seed] Seeding initial users...');
    const hashedStark = await bcrypt.hash('Jarvis123!', 10);
    const hashedCap = await bcrypt.hash('Vanguard123!', 10);
    const hashedStudent1 = await bcrypt.hash('Webs123!', 10);
    const hashedStudent2 = await bcrypt.hash('RedRoom123!', 10);

    await db.Users.create({
      name: 'Tony Stark',
      alias: 'Iron Man (Administrator 1)',
      email: 'tony@iris.shield',
      password: hashedStark,
      role: 'admin',
      clearance: 'Level 10 - Stark Command',
      badgeId: 'IRIS-ADMIN-01'
    });

    await db.Users.create({
      name: 'Steve Rogers',
      alias: 'Captain America (Administrator 2)',
      email: 'cap@iris.shield',
      password: hashedCap,
      role: 'admin',
      clearance: 'Level 10 - Vanguard Command',
      badgeId: 'IRIS-ADMIN-02'
    });

    await db.Users.create({
      name: 'Peter Parker',
      alias: 'Spider-Man',
      email: 'spidey@iris.shield',
      password: hashedStudent1,
      role: 'student',
      clearance: 'Level 4 - Operative',
      badgeId: 'IRIS-MEMBER-104'
    });

    await db.Users.create({
      name: 'Natasha Romanoff',
      alias: 'Black Widow',
      email: 'widow@iris.shield',
      password: hashedStudent2,
      role: 'student',
      clearance: 'Level 6 - Specialist',
      badgeId: 'IRIS-MEMBER-077'
    });

    console.log('[Seed] Admin and student accounts created.');
  }

  const existingExams = await db.Exams.find();
  if (existingExams.length === 0) {
    console.log('[Seed] Seeding initial mock exam protocol...');
    await db.Exams.create({
      title: 'Team Mock Assessment',
      code: 'EXAM-465',
      subject: 'Core Engineering & Navigation',
      description: 'Timed assessment with anti-cheat protection and per-candidate question randomization.',
      durationMinutes: 15,
      marksPerQuestion: 4,
      negativeMarkPerQuestion: 1,
      violationThreshold: 1,
      answerKeyRelease: 'immediate',
      status: 'published',
      isLive: true,
      instructions: [
        'Fullscreen mode is strictly enforced.',
        'Tab switching, external AI usage, or losing window focus results in immediate disqualification and blocking.',
        'Questions are uniquely allocated per candidate.'
      ],
      questions: [
        {
          id: '19dd8c65-8f43-417a-988f-c908cda2695a',
          questionText: 'Which is NOT a weakness of a compass?',
          options: [
            'It is affected by nearby iron',
            'It needs skill to use',
            'It gives direction only',
            'It stops working without satellite signal'
          ],
          correctOptionIndex: 3,
          explanation: "A magnetic compass operates purely via Earth's magnetic field and does not rely on satellite signals.",
          revisionConcept: 'Navigation Systems'
        },
        {
          id: '28bb7d14-3e91-4c55-901b-d18302fbc789',
          questionText: 'Which method of finding own position is used when no feature is common to both the map and the ground?',
          options: [
            'Inspection method',
            'Resection method',
            'Parallel method',
            'Straightedge method'
          ],
          correctOptionIndex: 1,
          explanation: "Resection method determines one's own position by drawing back-azimuth lines from two or more visible distant points.",
          revisionConcept: 'Topography & Positioning'
        },
        {
          id: '37cf9e42-7a22-48df-b452-f90918ace451',
          questionText: 'Which is true of the Equal Altitude method of finding north?',
          options: [
            'It is quick and works in cloud',
            'It is accurate but slow and needs sunlight',
            'It needs the Pole Star',
            'It needs a watch'
          ],
          correctOptionIndex: 1,
          explanation: 'The Equal Altitude method utilizes the sun\'s shadow before and after noon; it is highly accurate but requires clear sunlight and time.',
          revisionConcept: 'Direction Finding'
        }
      ],
      createdBy: 'Tony Stark',
      startedAt: new Date().toISOString()
    });
    console.log('[Seed] Mock exam created with questions.');
  }
}

module.exports = { seedDatabase };
