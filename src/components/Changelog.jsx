import React, { useState } from 'react';
import styles from './Changelog.module.css';
import {typeColors} from '../constants.js'

// Принимаем initialEntries вместо entries
export default function Changelog({ initialEntries = [] }) {
  const [displayedEntries, setDisplayedEntries] = useState(initialEntries);
  const [allEntries, setAllEntries] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const loadMore = async () => {
    setIsLoading(true);
    let fullData = allEntries;

    // Скачиваем JSON только один раз при первом нажатии
    if (!fullData) {
      try {
        const response = await fetch('/api/changelog.json');
        fullData = await response.json();
        setAllEntries(fullData);
      } catch (error) {
        console.error("Ошибка загрузки данных", error);
        setIsLoading(false);
        return;
      }
    }

    // Добавляем следующие 10 записей
    const nextPage = page + 1;
    const nextEntries = fullData.slice(0, nextPage * itemsPerPage);
    
    setDisplayedEntries(nextEntries);
    setPage(nextPage);
    setIsLoading(false);
  };

  const hasMore = allEntries ? displayedEntries.length < allEntries.length : true;

  if (displayedEntries.length === 0) {
    return <div className={styles.container}><h2 className={styles.header}>Нет данных</h2></div>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.header}>Последние изменения</h1>
      
      <div className={styles.scrollArea}>
        {displayedEntries.map((entry) => (
          <div key={entry.id}>
            <div className={styles.entryInfo}>
              <span className={styles.author}>{entry.author}</span>
              <span>{new Date(entry.time).toLocaleDateString('ru-RU')}</span>
            </div>
            
            <ul className={styles.changeList}>
              {entry.changes.map((change, index) => (
                <li key={index} className={styles.changeItem}>
                  <span 
                    className={styles.badge}
                    style={{ backgroundColor: typeColors[change.type] || '#ccc' }}
                  >
                    {change.type}
                  </span>
                  <span className={styles.message}>{change.message}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        
        {/* Кнопка загрузки */}
        {hasMore && (
          <button 
            className={styles['load-more-btn']} 
            onClick={loadMore} 
            disabled={isLoading}
          >
            {isLoading ? 'Загрузка...' : 'Загрузить еще'}
          </button>
        )}
      </div>
    </div>
  );
}