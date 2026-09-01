import React from 'react';
import styles from './Changelog.module.css';

// Цвета для разных типов изменений
const typeColors = {
  Add: '#4ade80',    // Зеленый
  Fix: '#60a5fa',    // Синий
  Tweak: '#facc15',  // Желтый
  Remove: '#f87171'  // Красный
};

export default function Changelog({ entries }) {
  return (
    <div className={styles.container}>
      <h2 className={styles.header}>Последние изменения</h2>
      
      <div className={styles.scrollArea}>
        {entries.map((entry) => (
          <div key={entry.id}>
            <div className={styles.entryInfo}>
              <span className={styles.author}>{entry.author}</span>
              <span>{new Date(entry.time).toLocaleDateString('ru-RU')}</span>
            </div>
            
            <ul className={styles.changeList}>
              {entry.changes.map((change, index) => (
                <div key={index} className={styles.changeItem}>
                  <span 
                    className={styles.badge}
                    style={{ backgroundColor: typeColors[change.type] || '#ccc' }}
                  >
                    {change.type}
                  </span>
                  <span>{change.message}</span>
                </div>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}