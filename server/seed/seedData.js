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
}

module.exports = { seedDatabase };
