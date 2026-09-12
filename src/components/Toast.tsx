import React, { useState, useEffect } from 'react';
import styles from './Toast.module.css';

export default function Toast() {
  // number что бы ретриггерить рендер посылая рандомное значение
  const [toast, setToast] = useState<[string, number]>(["", 0]);

  useEffect(() => {
    if ((window as any).showToast) {
      console.error("Слишком много тостов")
    }

    (window as any).showToast = (message: string) => {
      setToast([message, Date.now()]);
    };

    return () => {
      delete (window as any).showToast;
    };
  }, []);

  if (!toast[0]) return

  return (
    <div className={styles.toast}>
      <div 
        key={toast[1]} 
        className={styles.item} 
        onAnimationEnd={() => setToast(["", 0])}
      >
        {toast[0]}
      </div>
    </div>
  );
}
