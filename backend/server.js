const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

// Simple CORS header for dev
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, PUT, PATCH, POST, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'englishdb',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

// Initialize database
const initDb = async (retries = 5) => {
  while (retries) {
    try {
      // Users table
      await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        level VARCHAR(50) DEFAULT 'Beginner',
        xp_points INT DEFAULT 0
      );
    `);

    // Words table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS words (
        id SERIAL PRIMARY KEY,
        english_word VARCHAR(255) NOT NULL,
        turkish_translation VARCHAR(255) NOT NULL,
        learned_status BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Reading texts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reading_texts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        difficulty VARCHAR(50) NOT NULL
      );
    `);

    // Seed Users
    const { rows: userRows } = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userRows[0].count) === 0) {
      console.log('Seeding initial user...');
      await pool.query("INSERT INTO users (username, level, xp_points) VALUES ('Kadir', 'Intermediate', 150)");
    }

    // Seed Words
    const { rows: wordRows } = await pool.query('SELECT COUNT(*) FROM words');
    if (parseInt(wordRows[0].count) === 0) {
      console.log('Seeding initial vocabulary...');
      const seedWords = [
        ['Accomplish', 'Başarmak, sonuçlandırmak'],
        ['Breathtaking', 'Nefes kesici'],
        ['Consequence', 'Sonuç, netice'],
        ['Determine', 'Belirlemek, saptamak'],
        ['Enthusiastic', 'Hevesli, coşkulu'],
        ['Fascinating', 'Büyüleyici'],
        ['Genuine', 'Gerçek, hakiki, samimi'],
        ['Hesitate', 'Tereddüt etmek'],
        ['Inevitable', 'Kaçınılmaz'],
        ['Justify', 'Haklı çıkarmak, savunmak'],
        ['Resilient', 'Dirençli, çabuk iyileşen'],
        ['Serendipity', 'Tesadüfen bulma, şanslı tesadüf'],
        ['Ubiquitous', 'Her yerde birden bulunan'],
        ['Vulnerable', 'Savunmasız, kırılgan'],
        ['Zealous', 'Gayretli, şevkli, ateşli'],
        ['Meticulous', 'Titiz, kılı kırk yaran'],
        ['Eloquent', 'Etkili ve güzel konuşan'],
        ['Tenacious', 'İnatçı, vazgeçmeyen']
      ];
      for (const [word, meaning] of seedWords) {
        await pool.query(
          'INSERT INTO words (english_word, turkish_translation) VALUES ($1, $2)',
          [word, meaning]
        );
      }
    }

    // Seed Reading Texts
    const { rows: textRows } = await pool.query('SELECT COUNT(*) FROM reading_texts');
    if (parseInt(textRows[0].count) === 0) {
      console.log('Seeding initial texts...');
      const seedTexts = [
        ['A Day in the Park', 'Yesterday, I went to the park. The sun was shining brightly, and children were playing. I sat on a bench and read my favorite book. It was very peaceful.', 'Beginner'],
        ['My Morning Routine', 'Every morning, I wake up at 7 AM. I brush my teeth, take a shower, and then have breakfast. I usually eat eggs and drink a cup of coffee before starting my work.', 'Beginner'],
        ['The Future of Technology', 'Artificial Intelligence is rapidly changing our world. From self-driving cars to virtual assistants, technology is becoming an integral part of our daily lives. We must adapt to these changes carefully.', 'Intermediate'],
        ['Space Exploration', 'Humanity has always looked up at the stars with wonder. With recent advancements in reusable rockets, colonizing other planets like Mars is no longer just science fiction, but a realistic goal for the upcoming decades.', 'Advanced'],
        ['The Importance of Sleep', 'Adequate sleep is crucial for maintaining both physical and mental health. During deep sleep, our bodies repair tissues, while our brains consolidate memories and process emotions. Chronic sleep deprivation can lead to serious health issues.', 'Advanced']
      ];
      for (const [title, content, diff] of seedTexts) {
        await pool.query(
          'INSERT INTO reading_texts (title, content, difficulty) VALUES ($1, $2, $3)',
          [title, content, diff]
        );
      }
    }

      console.log('Database initialized successfully');
      return; // Exit loop on success
    } catch (err) {
      console.error('Error initializing database, retries left:', retries - 1, err.message);
      retries -= 1;
      await new Promise(res => setTimeout(res, 3000)); // wait 3 seconds before retry
    }
  }
};

initDb();

// --- API ROUTES ---

// 1. Profile
app.get('/api/profile', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users LIMIT 1');
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Vocabulary
app.get('/api/words', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM words ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/words', async (req, res) => {
  const { english_word, turkish_translation } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO words (english_word, turkish_translation) VALUES ($1, $2) RETURNING *',
      [english_word, turkish_translation]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/words/:id', async (req, res) => {
  const { id } = req.params;
  const { learned_status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE words SET learned_status = $1 WHERE id = $2 RETURNING *',
      [learned_status, id]
    );
    // Add XP to user if learned
    if (learned_status) {
      await pool.query('UPDATE users SET xp_points = xp_points + 10 WHERE id = 1');
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Reading Texts
app.get('/api/texts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reading_texts ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`API Server running on port ${port}`);
});
