export default function Footer() {
  return (
    <footer style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 54,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgb(22, 22, 22)',
      borderTop: '1px solid rgb(34, 34, 34)',
      fontSize: 13,
      color: 'rgb(112, 112, 112)',
      letterSpacing: '0.06em',
      fontFamily: '"Noto Sans JP", sans-serif',
      zIndex: 200,
    }}>
      {/* PC 表示 */}
      <span className="footer-full">
        © 2026{' '}
        <a href="https://x.com/WL_GE_inn" target="_blank" rel="noopener noreferrer"
          style={{ color: 'rgb(136, 136, 136)', textDecoration: 'none' }}>
          kinshutei
        </a>
        　|　非公式ファンサイト — 妃玖（Kisaki / RKmusic）　|　掲載情報の誤りは{' '}
        <a href="https://x.com/WL_GE_inn" target="_blank" rel="noopener noreferrer"
          style={{ color: 'rgb(136, 136, 136)', textDecoration: 'none' }}>
          @WL_GE_inn
        </a>{' '}
        までお気軽にどうぞ
      </span>
      {/* スマホ表示 */}
      <span className="footer-short">
        © 2026 金鷲亭　|　妃玖(Kisaki / RKmusic) 非公式ファンサイト
      </span>
    </footer>
  )
}
