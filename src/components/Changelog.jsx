import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './Changelog.module.css';
import { typeColors } from '../constants.js';

export default function Changelog({ initialEntries = [] }) {
  const [displayedEntries, setDisplayedEntries] = useState(initialEntries);
  const [allEntries, setAllEntries] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const scrollAreaRef = useRef(null);
  const sentinelRef = useRef(null);
  const isLoadingRef = useRef(false);

  const hasMore = allEntries ? displayedEntries.length < allEntries.length : true;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

  const loadMore = useCallback(async () => {
    // Предотвращаем параллельные запросы
    if (isLoadingRef.current || !hasMoreRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);

    let fullData = allEntries;

    if (!fullData) {
      try {
        const response = await fetch('/api/changelog.json');
        fullData = await response.json();
        setAllEntries(fullData);
      } catch (error) {
        console.error('Ошибка загрузки данных', error);
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }
    }

    const nextPage = page + 1;
    const nextEntries = fullData.slice(0, nextPage * itemsPerPage);

    setDisplayedEntries(nextEntries);
    setPage(nextPage);
    setIsLoading(false);
    isLoadingRef.current = false;
  }, [allEntries, page]);

  useEffect(() => {
    const scrollContainer = scrollAreaRef.current;
    const sentinel = sentinelRef.current;

    if (!sentinel || !scrollContainer) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Если маячок показался в зоне видимости и есть что грузить
        if (entries[0].isIntersecting && hasMoreRef.current && !isLoadingRef.current) {
          loadMore();
        }
      },
      {
        root: scrollContainer, // ВАЖНО: скроллится именно scrollArea, а не окно браузера!
        rootMargin: '40px',    // Срабатывает за 40px до конца (для плавной подгрузки)
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [loadMore]);

  if (displayedEntries.length === 0 && !isLoading) {
    return (
      <div className={styles.container}>
        <h2 className={styles.header}>Нет данных</h2>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.header}>Последние изменения</h1>

      <div className={styles.scrollArea} ref={scrollAreaRef}>
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

        {/* Невидимый триггер окончания списка */}
        {hasMore && <div ref={sentinelRef} className={styles.sentinel} />}

        {/* Индикатор загрузки внизу */}
        {isLoading && (
          <div className={styles.loaderContainer}>
            <div className={styles.spinner} />
            <span>Загрузка...</span>
          </div>
        )}

        {/* Подпись, когда всё прогружено */}
        {!hasMore && displayedEntries.length > 0 && (
          <div className={styles.endMessage}>Вы просмотрели все изменения</div>
        )}
      </div>
    </div>
  );
}