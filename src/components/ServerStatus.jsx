import React, { useState, useEffect } from 'react';
import styles from './ServerStatus.module.css';
import { HUB_URL, TARGET_ADDRESS } from '../constants.js';

export default function ServerStatus() {
  const [serverData, setServerData] = useState(null);
  const [isError, setIsError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);

  const serverIp = TARGET_ADDRESS || 'maidstation.ru';

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(serverIp);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = serverIp;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Ошибка при копировании:', err);
    }
  };

  // Эффект 1: Тикающий таймер каждую секунду
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Эффект 2: Запрос к хабу каждые 60 секунд
  useEffect(() => {
    const fetchServerData = async () => {
      try {
        const response = await fetch(HUB_URL);
        if (!response.ok) throw new Error('Ошибка хаба');
        
        const data = await response.json();
        const myServer = data.find((s) => s.address === TARGET_ADDRESS);
        
        if (myServer) {
          setServerData(myServer.statusData);
          setIsError(false);
        } else {
          setIsError(true);
        }
      } catch (err) {
        console.error('Не удалось получить статус сервера:', err);
        setIsError(true);
      }
    };

    fetchServerData();
    const interval = setInterval(fetchServerData, 60000);
    return () => clearInterval(interval);
  }, []);

  const getFormattedTime = (startTime) => {
    if (!startTime) return '00:00';
    const diff = Math.floor((now - new Date(startTime).getTime()) / 1000);
    if (diff < 0) return '00:00';

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    const pad = (num) => num.toString().padStart(2, '0');

    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
  };

  // Верхняя строка (только название и темная кнопка-адрес)
  const renderTopRow = () => (
    <div className={styles.topRow}>
      <h2 className={styles.serverName}>Maid</h2>

      <button 
        type="button"
        className={`${styles.copyButton} ${copied ? styles.copied : ''}`}
        onClick={handleCopy}
        title="Нажмите, чтобы скопировать"
      >
        <span className={styles.serverAddress}>
          {copied ? 'Скопировано' : serverIp}
        </span>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" className={styles.copyIcon}>
          {copied ? (
            <polyline points="20 6 9 17 4 12" />
          ) : (
            <>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </>
          )}
        </svg>
      </button>
    </div>
  );

  // 1. Состояние: Загрузка
  if (!serverData && !isError) {
    return (
      <div className={styles.container}>
        {renderTopRow()}
        <div className={styles.bottomRow}>
          <span className={`${styles.roundTime} ${styles.skeleton}`}>Загрузка...</span>
        </div>
      </div>
    );
  }

  // 2. Состояние: Оффлайн
  if (isError || !serverData) {
    return (
      <div className={styles.container}>
        {renderTopRow()}
        <div className={styles.bottomRow}>
          <span className={styles.roundTime}>Сервер недоступен</span>
          <div className={styles.statsRight}>
            <span className={styles.players}>0/0</span>
            <div className={`${styles.statusDot} ${styles.offline}`} title="Оффлайн"></div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Состояние: Онлайн
  const { players, soft_max_players, run_level, round_start_time } = serverData;
  const isRoundActive = run_level === 1;
  const timeDisplay = isRoundActive 
    ? `В раунде ${getFormattedTime(round_start_time)}`
    : 'В лобби';

  return (
    <div className={styles.container}>
      {renderTopRow()}
      
      <div className={styles.bottomRow}>
        <span className={styles.roundTime}>{timeDisplay}</span>
        
        <div className={styles.statsRight}>
          <span className={styles.players}>{players}/{soft_max_players}</span>
          <div className={styles.statusDot} title="Сервер онлайн"></div>
        </div>
      </div>
    </div>
  );
}