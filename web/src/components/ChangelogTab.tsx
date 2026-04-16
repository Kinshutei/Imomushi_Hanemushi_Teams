export default function ChangelogTab() {
  const entries = [
    {
      date: '2026-04-15',
      items: [
        'サイトデザインを全面リニューアル。サイドバー＋動画背景のシネマティックなレイアウトに変更。',
        'サイト名を「芋虫羽虫㌠の部屋」に変更。',
      ],
    },
    {
      date: '2026-03-20',
      items: [
        '別DBとの共通化処理のため、DBの大幅構造変更を行いました。ご利用者の皆様への影響はございません。',
        'ただし当作業の別影響として、閲覧者の方によっては「この曲の歌い手は◯◯と言うより××と表記すべきでは？」と疑念を感じる方もいるかも知れません。後日頑張りますので、現時点ではご容赦下さい。',
        'LiveStreaming Info タブにおいて、初めて歌われた曲に「初」フラグが立つようになりました。',
        '同タブにて、従来は検索ワードは楽曲名にのみ効いていましたが、今後はアーティスト名も引っ掛けられます。',
        'Uta-Mita DB タブにおいて、楽曲リストにスクロールを実装。今後の歌唱楽曲増大に備え改修。',
        '同タブにおいて、リリース年度分布はツリーマップ→棒グラフへと変更。',
      ],
    },
    {
      date: '2026-03-17',
      items: [
        '背景に籠目模様とアニメーションを試験的に追加',
        'LiveStreaming Info タブの枠情報に関するデザインを更新',
      ],
    },
    {
      date: '2026-03-13',
      items: ['サイト公開'],
    },
  ]

  return (
    <div style={{ lineHeight: 1.85, color: '#c0c0c0' }}>
      <section>
        <h3 style={{ color: '#5fcf80', fontSize: '1.1rem' }}>更新履歴</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <tbody>
            {entries.map((entry) =>
              entry.items.map((item, i) => (
                <tr key={`${entry.date}-${i}`}>
                  <td style={{
                    padding: '8px 16px 8px 0',
                    borderBottom: '1px solid #1e1e1e',
                    color: '#606060',
                    whiteSpace: 'nowrap',
                    verticalAlign: 'top',
                    width: 120,
                  }}>
                    {i === 0 ? entry.date : ''}
                  </td>
                  <td style={{
                    padding: '8px 0',
                    borderBottom: '1px solid #1e1e1e',
                    color: '#c0c0c0',
                  }}>
                    {item}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
