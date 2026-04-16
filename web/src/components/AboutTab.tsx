export default function AboutTab() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', lineHeight: 1.85, color: '#c0c0c0' }}>

      {/* ─── サイトについて ─── */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ color: '#5fcf80', fontSize: '1.1rem' }}>当サイトについて</h3>
        <p>
          当サイトはRK Music所属のVSinger <strong style={{ color: '#5fcf80' }}>妃玖（Kisaki）</strong>さんの歌ってみた・配信情報をまとめたファンメイドのデータベースサイトです。
          デビューからの全歌枠を網羅することを目標としており、過去の配信を振り返ったり、あの曲いつ歌ってたっけ？を調べるのにお役立てください。
        </p>
        <p>
          公式サイトではありませんので、掲載情報には誤りを含む場合がございます。RK Music及び妃玖さんへの直接のお問い合わせはなさらないようお願いいたします。ご質問・誤りのご指摘については、<a href="https://x.com/WL_GE_inn" target="_blank" rel="noopener noreferrer">白百合と金鷲亭(@WL_GE_inn)</a>までお気軽にどうぞ。
        </p>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          ※ 掲載情報は有志（若干1名）が手動で更新しています。リアルタイムの反映はできないため、最新情報は妃玖さんの公式SNSをご確認ください。
        </p>
      </section>

      {/* ─── 構築目的 ─── */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ color: '#5fcf80', fontSize: '1.1rem' }}>当サイトの構築目的</h3>
        <p>
          妃玖さんの歌声に出会った方が過去の配信をたどりやすくなるよう、そして長く応援してくださっているファンの方々が「あの曲、何回歌ったっけ」「最後に歌ったのいつだったかな？」と楽しめるよう、記録と可視化を目的として開設しました。
          妃玖さんの活動がより多くの方に届き、モチベーション向上に少しでも貢献できれば幸いです。
        </p>
      </section>

      {/* ─── タブの説明 ─── */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ color: '#5fcf80', fontSize: '1.1rem' }}>タブの使い方</h3>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{
            background: '#161616',
            border: '1px solid #222',
            borderRadius: 8,
            padding: '14px 18px',
          }}>
            <div style={{ fontWeight: 700, color: '#5fcf80', marginBottom: 6, fontSize: '0.95rem' }}>
              🎙 LiveStreaming Info
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#a0a0a0' }}>
              歌枠・配信ごとのセットリスト一覧です。配信日・枠名でグループ化され、
              各枠をクリックすると歌唱曲リストが展開します。
              曲名で検索するとヒットした枠・曲だけに絞り込めます。YouTube リンクから該当配信へ直接移動でき、楽曲URLからはその歌が始まるあたりへ飛べます！
            </p>
          </div>

          <div style={{
            background: '#161616',
            border: '1px solid #222',
            borderRadius: 8,
            padding: '14px 18px',
          }}>
            <div style={{ fontWeight: 700, color: '#5fcf80', marginBottom: 6, fontSize: '0.95rem' }}>
              🎵 Sung Repertoire
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#a0a0a0' }}>
              楽曲ごとの集計データです。列ヘッダーをクリックするとその列でソートできます。
              下部のグラフで歌唱回数ランキング・リリース年度分布・原曲アーティスト分布を確認できます。
            </p>
          </div>

          <div style={{
            background: '#161616',
            border: '1px solid #222',
            borderRadius: 8,
            padding: '14px 18px',
          }}>
            <div style={{ fontWeight: 700, color: '#5fcf80', marginBottom: 6, fontSize: '0.95rem' }}>
              📋 更新履歴
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#a0a0a0' }}>
              当サイトの更新内容を記録しています。データの追加・機能の変更などを随時掲載します。
            </p>
          </div>
        </div>
      </section>

      {/* ─── データについて ─── */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ color: '#5fcf80', fontSize: '1.1rem' }}>データについて</h3>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.88rem',
          color: '#a0a0a0',
        }}>
          <tbody>
            {[
              ['データ形式', 'CSV（GitHubリポジトリで管理）'],
              ['更新タイミング', '歌枠終了後に手動更新'],
              ['収録範囲', '妃玖の歌枠・歌ってみた動画（デビューから網羅を目標）'],
              ['コラボ枠', 'コラボ相手様の名前も記録しています'],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #1e1e1e',
                  color: '#606060',
                  whiteSpace: 'nowrap',
                  width: 160,
                }}>{k}</td>
                <td style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #1e1e1e',
                }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ─── リンク ─── */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ color: '#5fcf80', fontSize: '1.1rem' }}>リンク</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a
            href="https://www.youtube.com/@妃玖-kisaki/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#5fcf80', fontSize: '0.95rem' }}
          >
            ▶ 妃玖 YouTube チャンネル
          </a>
          <a
            href="https://x.com/fused_kisaki"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#5fcf80', fontSize: '0.95rem' }}
          >
            𝕏 妃玖 X（Twitter）
          </a>
        </div>
      </section>

      {/* ─── 免責事項 ─── */}
      <section>
        <h3 style={{ color: '#5fcf80', fontSize: '1.1rem' }}>免責事項</h3>
        <p style={{ fontSize: '0.85rem', color: '#555', lineHeight: 1.8 }}>
          当サイトは個人が運営するものであり、RK Music様および妃玖様とは無関係です。掲載情報の正確性は確保するよう努めておりますが、誤りを含む場合がございます。RK Music様および妃玖様より情報の削除を要請された場合は、速やかに対応いたします。
        </p>
      </section>

    </div>
  )
}
