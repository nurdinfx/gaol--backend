import bcrypt from 'bcryptjs';

export class MemoryDB {
  constructor() {
    this.data = {
      users: [],
      villages: [],
      customers: [],
      workers: [],
      cars: []
    };
    this.init();
  }

  init() {
    // Create admin user if not exists
    const adminExists = this.data.users.find(u => u.username === 'admin');
    if (!adminExists) {
      const hashedPassword = bcrypt.hashSync('admin123', 12);
      this.data.users.push({
        id: 'admin-user',
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
        name: 'System Administrator',
        createdAt: new Date()
      });
    }
  }

  async create(collection, data) {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const item = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
    this.data[collection].push(item);
    return item;
  }

  async find(collection, query = {}) {
    let items = this.data[collection];
    
    // Simple query filtering
    if (Object.keys(query).length > 0) {
      items = items.filter(item => {
        return Object.keys(query).every(key => {
          if (key === 'id' && query[key] === item.id) return true;
          if (item[key] === query[key]) return true;
          return false;
        });
      });
    }
    
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async findById(collection, id) {
    return this.data[collection].find(item => item.id === id);
  }

  async update(collection, id, updates) {
    const index = this.data[collection].findIndex(item => item.id === id);
    if (index === -1) return null;
    
    this.data[collection][index] = {
      ...this.data[collection][index],
      ...updates,
      updatedAt: new Date()
    };
    
    return this.data[collection][index];
  }

  async delete(collection, id) {
    const index = this.data[collection].findIndex(item => item.id === id);
    if (index === -1) return false;
    
    this.data[collection].splice(index, 1);
    return true;
  }
}