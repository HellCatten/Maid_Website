import React, { useState, useEffect } from 'react';
import styles from './ServerConnect.module.css';
import { HUB_URL, TARGET_ADDRESS } from '../constants.js';

const STEAM_APP_URL = 'steam://run/987840';

// Преобразуем текстовый символ кометы в цветной эмодзи
const formatServerName = (name) => {
  if (!name) return '';
  return name.replace(/\u2604[\uFE0E\uFE0F]?/g, '☄️');
};

export default function ServerConnect() {
  const [serverData, setServerData] = useState(null);
  const [serverName, setServerName] = useState(formatServerName('[RU][16+][TTS] Maid ☄️'));
  const [isError, setIsError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);

  const serverIp = TARGET_ADDRESS || 'maidstation.ru';

  // Копирование IP адреса
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
      console.error('Ошибка копирования:', err);
    }
  };

  // Эффект 1: Тикающий таймер каждую секунду
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Эффект 2: Запрос к хабу каждые 60 секунд со строгим поиском по TARGET_ADDRESS
  useEffect(() => {
    const fetchServerData = async () => {
      try {
        const response = await fetch(HUB_URL);
        if (!response.ok) throw new Error('Ошибка хаба');
        
        const data = await response.json();
        const myServer = data.find((s) => s.address === TARGET_ADDRESS);
        
        if (myServer && myServer.statusData) {
          setServerData(myServer.statusData);
          if (myServer.statusData.name) {
            setServerName(formatServerName(myServer.statusData.name));
          }
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

  // Форматирование времени раунда
  const getLauncherRoundTime = (startTime, runLevel) => {
    if (runLevel !== 1 || !startTime) return 'В лобби';

    const diff = Math.floor((now - new Date(startTime).getTime()) / 1000);
    if (diff < 0) return '0M';

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);

    if (hours > 0) {
      return `${hours}H ${minutes}M`;
    }
    return `${minutes}M`;
  };

  const roundTime = serverData
    ? getLauncherRoundTime(serverData.round_start_time, serverData.run_level)
    : isError ? '—' : '...';

  const playersDisplay = serverData
    ? `${serverData.players} / ${serverData.soft_max_players ?? 80}`
    : isError ? '0 / 80' : '...';

  return (
    <div className={styles.connectWrapper}>
      
      {/* ЛЕВЫЙ БЛОК: Хаб лаунчера */}
      <div className={styles.hubSearchBox}>
        <div className={styles.boxTitle}>Ищите сервер в хабе лаунчера:</div>
        
        <div className={styles.ss14ServerRow}>
          <span className={styles.serverArrow}>▶</span>
          
          <div className={styles.serverTitleText} title={serverName}>
            {serverName}
          </div>

          <div className={styles.serverDivider}></div>
          <div className={styles.serverMeta} title="Время раунда">{roundTime}</div>

          <div className={styles.serverDivider}></div>
          <div className={styles.serverMeta} title="Игроков онлайн">{playersDisplay}</div>

          {/* Запуск игры в Steam */}
          <a 
            href={STEAM_APP_URL}
            className={styles.connectBtn}
            title="Запустить Space Station 14 в Steam"
          >
            Подключиться
          </a>
        </div>
      </div>

      {/* ПРАВЫЙ БЛОК: Прямое подключение */}
      <div className={styles.directConnectBox}>
        <div className={styles.boxTitle}>или подключитесь напрямую:</div>
        
        <button 
          type="button" 
          className={`${styles.directIpCard} ${copied ? styles.copied : ''}`}
          onClick={handleCopy}
          title="Нажмите, чтобы скопировать адрес"
        >
          <div className={styles.ipInfoGroup}>
            <span className={styles.ipProtocol}>ADDRESS :</span>
            <span className={styles.ipAddressText}>{serverIp}</span>
          </div>

          <div className={styles.copyBadge}>
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Скопировано</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Копировать</span>
              </>
            )}
          </div>
        </button>
      </div>

    </div>
  );
}