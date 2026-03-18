export default function ChangelogTab() {
  const entries = [
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
    <div style={{ maxWidth: 760, margin: '0 auto', lineHeight: 1.85, color: '#c0c0c0' }}>
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
