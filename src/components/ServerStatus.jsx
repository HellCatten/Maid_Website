import React, { useState, useEffect } from 'react';
import styles from './ServerStatus.module.css';
import {HUB_URL, SERVER} from '../constants.js'

/**
 * Регулярка возвращающая "красивую" ссылку
 */
const sanitizeAddressRegex = /^(?:ss14s?:\/\/)?([^\s]*)$/;

/**
 * 
 * @param {{
 *  name?: string,
 *  address?: string
 * }}
 */
export default function ServerStatus({
  name = SERVER.name, 
  address = SERVER.address
}) {
  const [serverData, setServerData] = useState(null);
  const [isError, setIsError] = useState(false);
  const [now, setNow] = useState(Date.now()); // Состояние для тикающего таймера

  // Эффект 1: Тикающий таймер (обновляется каждую секунду)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Эффект 2: Запрос к API хаба (каждые 60 секунд)
  useEffect(() => {
    const fetchServerData = async () => {
      try {
        const response = await fetch(HUB_URL);
        if (!response.ok) throw new Error("Ошибка хаба");
        
        const data = await response.json();
        // Быстрый поиск нашего сервера
        const myServer = data.find(s => s.address === address);
        
        if (myServer) {
          setServerData(myServer.statusData);
          setIsError(false);
        } else {
          setIsError(true);
        }
      } catch (err) {
        console.error("Не удалось получить статус сервера:", err);
        setIsError(true);
      }
    };

    fetchServerData(); // Делаем запрос сразу при загрузке
    const interval = setInterval(fetchServerData, 60000); // И затем каждую минуту
    
    return () => clearInterval(interval);
  }, [address]);

  // Функция для расчета красивого времени (1:30:03)
  const getFormattedTime = (startTime) => {
    if (!startTime) return "00:00";
    
    // Разница между текущим моментом и стартом раунда (в секундах)
    const diff = Math.floor((now - new Date(startTime).getTime()) / 1000);
    if (diff < 0) return "00:00";

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    const pad = (num) => num.toString().padStart(2, '0');

    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
  };

  // Для входа достаточно maidstation14.ru, протокол можно эммитить
  let sanitizedAddress = sanitizeAddressRegex.exec(address)?.[1] || address

  const onClick = async (e) => {
    e?.preventDefault();
    try {
      await navigator.clipboard.writeText(address);
      window.showToast?.("Скопировано в буфер обмена");
    } catch (err) {
      window.showToast?.("Не удалось скопировать в буфер обмена");
      console.error(err)
    }
  };

  let topRow = (
    <div className={styles.topRow}>
      <h1 className={styles.serverName}>{name}</h1>
      <a onClick={onClick} className={styles.serverAddress}>{sanitizedAddress}</a>
    </div>
  )  

  // 1. Состояние: Загрузка
  if (!serverData && !isError) {
    return (
      <div className={styles.container}>
        {topRow}
        <div className={styles.bottomRow}>
          <span className={`${styles.roundTime} ${styles.skeleton}`}>Загрузка...</span>
        </div>
      </div>
    );
  }

  // 2. Состояние: Сервер оффлайн или не найден
  if (isError || !serverData) {
    return (
      <div className={styles.container}>
        {topRow}
        <div className={styles.bottomRow}>
          <span className={styles.roundTime}>Сервер недоступен</span>
          <div className={styles.statsRight}>
            <span className={styles.players}>0/0</span>
            <div className={`${styles.statusDot} ${styles.offline}`}></div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Состояние: Сервер онлайн
  const { players, soft_max_players, run_level, round_start_time } = serverData;
  
  // В SS14 run_level обычно: 0 - Предматчевое лобби, 1 - В раунде, 2 - Конец раунда
  const isRoundActive = run_level === 1;
  const timeDisplay = isRoundActive 
    ? `В раунде ${getFormattedTime(round_start_time)}`
    : "В лобби";

  return (
    <div className={styles.container}>
      {topRow}
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