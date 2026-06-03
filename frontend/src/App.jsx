import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { BookOpen, Library, UserCircle, CheckCircle2 } from 'lucide-react';

// --- COMPONENTS ---
const Navbar = () => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <nav className="glass-nav">
      <div className="nav-brand">EnglishPro</div>
      <div className="nav-links">
        <Link to="/" className={isActive('/')}><UserCircle size={20} /> Profile</Link>
        <Link to="/vocab" className={isActive('/vocab')}><Library size={20} /> Vocab</Link>
        <Link to="/reading" className={isActive('/reading')}><BookOpen size={20} /> Reading</Link>
      </div>
    </nav>
  );
};

// --- PAGES ---
const ProfilePage = () => {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(setProfile)
      .catch(console.error);
  }, []);

  if (!profile) return <div className="loading">Loading...</div>;
  if (profile.error) return <div className="loading">Error loading profile: {profile.error}</div>;
  if (!profile.username) return <div className="loading">Profile data is missing or database is not seeded.</div>;

  return (
    <div className="page-container fade-in">
      <h1 className="page-title">bulut bilisim</h1>
      <div className="glass-card profile-card">
        <div className="avatar">{profile.username[0]}</div>
        <h2>{profile.username}</h2>
        <div className="stats">
          <div className="stat-box">
            <span>Level</span>
            <strong>{profile.level}</strong>
          </div>
          <div className="stat-box">
            <span>Total XP</span>
            <strong>{profile.xp_points}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

const VocabPage = () => {
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWord, setNewWord] = useState({ english: '', turkish: '' });

  useEffect(() => {
    fetch('/api/words')
      .then(r => r.json())
      .then(data => setWords(data))
      .catch(console.error);
  }, []);

  const handleAddWord = async (e) => {
    e.preventDefault();
    if (!newWord.english || !newWord.turkish) return;

    const res = await fetch('/api/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ english_word: newWord.english, turkish_translation: newWord.turkish })
    });
    
    if (res.ok) {
      const addedWord = await res.json();
      setWords([...words, addedWord]);
      setNewWord({ english: '', turkish: '' });
      setShowAddForm(false);
    }
  };

  if (words.length === 0) return <div className="loading">Loading words...</div>;

  const currentWord = words[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, 150);
  };

  const handleMarkLearned = async () => {
    const newStatus = !currentWord.learned_status;
    const res = await fetch(`/api/words/${currentWord.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ learned_status: newStatus })
    });
    if (res.ok) {
      const updated = await res.json();
      setWords(words.map((w, i) => i === currentIndex ? updated : w));
    }
  };

  return (
    <div className="page-container fade-in">
      <div className="header-actions">
        <h1 className="page-title">Vocabulary Flashcards</h1>
        <button className="btn-secondary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : '+ Add Word'}
        </button>
      </div>

      {showAddForm && (
        <div className="glass-card add-word-form fade-in">
          <h2>Add New Word</h2>
          <form onSubmit={handleAddWord}>
            <div className="form-group">
              <input
                type="text"
                placeholder="English Word"
                value={newWord.english}
                onChange={(e) => setNewWord({ ...newWord, english: e.target.value })}
                className="glass-input"
              />
            </div>
            <div className="form-group">
              <input
                type="text"
                placeholder="Turkish Translation"
                value={newWord.turkish}
                onChange={(e) => setNewWord({ ...newWord, turkish: e.target.value })}
                className="glass-input"
              />
            </div>
            <button type="submit" className="btn-primary">Save Word</button>
          </form>
        </div>
      )}

      <div className="flashcard-container">
        <div className={`flashcard ${isFlipped ? 'is-flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}>
          <div className="flashcard-inner">
            <div className="flashcard-front">
              {currentWord.learned_status && <CheckCircle2 className="learned-icon" size={32} />}
              <h2>{currentWord.english_word}</h2>
              <p>Click to flip</p>
            </div>
            <div className="flashcard-back">
              <h2>{currentWord.turkish_translation}</h2>
              <p>Click to flip back</p>
            </div>
          </div>
        </div>
      </div>
      <div className="controls">
        <button className={`btn-primary ${currentWord.learned_status ? 'learned' : ''}`} onClick={(e) => { e.stopPropagation(); handleMarkLearned(); }}>
          {currentWord.learned_status ? 'Unmark Learned' : 'Mark as Learned (+10 XP)'}
        </button>
        <button className="btn-secondary" onClick={handleNext}>Next Word &rarr;</button>
      </div>
      <div className="progress">Card {currentIndex + 1} of {words.length}</div>
    </div>
  );
};

const ReadingPage = () => {
  const [texts, setTexts] = useState([]);
  const [selectedText, setSelectedText] = useState(null);

  useEffect(() => {
    fetch('/api/texts')
      .then(r => r.json())
      .then(setTexts)
      .catch(console.error);
  }, []);

  return (
    <div className="page-container fade-in">
      <h1 className="page-title">Reading Comprehension</h1>
      
      {!selectedText ? (
        <div className="text-list">
          {texts.map(text => (
            <div key={text.id} className="glass-card list-item" onClick={() => setSelectedText(text)}>
              <h3>{text.title}</h3>
              <span className={`badge ${text.difficulty.toLowerCase()}`}>{text.difficulty}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card article">
          <button className="btn-back" onClick={() => setSelectedText(null)}>&larr; Back to list</button>
          <h2>{selectedText.title}</h2>
          <span className={`badge ${selectedText.difficulty.toLowerCase()}`}>{selectedText.difficulty}</span>
          <p className="article-content">{selectedText.content}</p>
        </div>
      )}
    </div>
  );
};

function App() {
  return (
    <div className="app-layout">
      <div className="background-animation"></div>
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<ProfilePage />} />
          <Route path="/vocab" element={<VocabPage />} />
          <Route path="/reading" element={<ReadingPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App;
