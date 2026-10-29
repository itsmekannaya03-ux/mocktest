const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class JsonCollection {
  constructor(name) {
    this.name = name;
    this.filePath = path.join(DATA_DIR, `${name}.json`);
    this.items = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.items = JSON.parse(raw);
      } else {
        this.items = [];
        this.persist();
      }
    } catch (err) {
      console.error(`Failed to load collection ${this.name}:`, err.message);
      this.items = [];
    }
  }

  persist() {
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.items, null, 2), 'utf8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error(`Failed to save collection ${this.name}:`, err.message);
    }
  }

  async find(predicate = {}) {
    this.load();
    if (typeof predicate === 'function') {
      return this.items.filter(predicate);
    }
    return this.items.filter(item => {
      for (const [key, val] of Object.entries(predicate)) {
        if (item[key] !== val) return false;
      }
      return true;
    });
  }

  async findOne(predicate = {}) {
    this.load();
    if (typeof predicate === 'function') {
      return this.items.find(predicate) || null;
    }
    return this.items.find(item => {
      for (const [key, val] of Object.entries(predicate)) {
        if (item[key] !== val) return false;
      }
      return true;
    }) || null;
  }

  async findById(id) {
    this.load();
    return this.items.find(item => item._id === id || item.id === id) || null;
  }

  async create(data) {
    this.load();
    const doc = {
      _id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    };
    this.items.push(doc);
    this.persist();
    return doc;
  }

  async updateOne(filter, updateData) {
    this.load();
    const index = this.items.findIndex(item => {
      if (typeof filter === 'string') return item._id === filter || item.id === filter;
      for (const [k, v] of Object.entries(filter)) {
        if (item[k] !== v) return false;
      }
      return true;
    });

    if (index === -1) return null;

    const current = this.items[index];
    const updated = {
      ...current,
      ...(updateData.$set ? updateData.$set : updateData),
      updatedAt: new Date().toISOString()
    };
    this.items[index] = updated;
    this.persist();
    return updated;
  }

  async deleteOne(filter) {
    this.load();
    const prevLength = this.items.length;
    this.items = this.items.filter(item => {
      if (typeof filter === 'string') return item._id !== filter && item.id !== filter;
      for (const [k, v] of Object.entries(filter)) {
        if (item[k] === v) return false;
      }
      return true;
    });
    this.persist();
    return this.items.length < prevLength;
  }

  async count(predicate = {}) {
    const list = await this.find(predicate);
    return list.length;
  }
}

const db = {
  Users: new JsonCollection('users'),
  Exams: new JsonCollection('exams'),
  Attempts: new JsonCollection('attempts'),
  Violations: new JsonCollection('violations'),
};

module.exports = db;
