import streamlit as st
import pandas as pd
import plotly.express as px
import sqlite3
import io
import os

DB_PATH = "utawaku.db"

CSV_COLUMNS = ["枠名", "楽曲名", "歌唱順", "配信日", "枠URL", "コラボ相手様"]

# ─────────────────────────────────────────
# DB初期化
# ─────────────────────────────────────────
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS streams (
            stream_id   INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            stream_date DATE NOT NULL,
            archive_url TEXT,
            UNIQUE(title, stream_date)
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS songs (
            song_id     INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            artist      TEXT,
            lyricist    TEXT,
            composer    TEXT,
            UNIQUE(title)
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS setlists (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            stream_id       INTEGER NOT NULL,
            song_id         INTEGER NOT NULL,
            order_in_stream INTEGER,
            song_url        TEXT,
            collab          TEXT,
            FOREIGN KEY (stream_id) REFERENCES streams(stream_id),
            FOREIGN KEY (song_id)   REFERENCES songs(song_id)
        )
    """)
    conn.commit()
    conn.close()

# ─────────────────────────────────────────
# DB操作ヘルパー
# ─────────────────────────────────────────
def get_conn():
    return sqlite3.connect(DB_PATH)

def fetch_df(query, params=()):
    conn = get_conn()
    df = pd.read_sql_query(query, conn, params=params)
    conn.close()
    return df

def execute(query, params=()):
    conn = get_conn()
    conn.execute(query, params)
    conn.commit()
    conn.close()

# ─────────────────────────────────────────
# CSV エクスポート
# ─────────────────────────────────────────
def export_csv() -> bytes:
    df = fetch_df("""
        SELECT
            st.title       AS 枠名,
            sg.title       AS 楽曲名,
            sl.order_in_stream AS 歌唱順,
            st.stream_date AS 配信日,
            sl.song_url    AS 枠URL,
            sl.collab      AS コラボ相手様
        FROM setlists sl
        JOIN streams st ON sl.stream_id = st.stream_id
        JOIN songs   sg ON sl.song_id   = sg.song_id
        ORDER BY st.stream_date, st.stream_id, sl.order_in_stream
    """)
    df = df[CSV_COLUMNS]
    buf = io.StringIO()
    df.to_csv(buf, index=False, encoding="utf-8-sig")
    return buf.getvalue().encode("utf-8-sig")

# ─────────────────────────────────────────
# CSV インポート（完全上書き）
# ─────────────────────────────────────────
def import_csv(uploaded_file) -> tuple[bool, str]:
    try:
        raw = uploaded_file.read()
        # BOM付きUTF-8 / Shift-JIS 両対応
        for enc in ("utf-8-sig", "shift-jis", "utf-8"):
            try:
                df = pd.read_csv(io.BytesIO(raw), encoding=enc)
                break
            except Exception:
                continue
        else:
            return False, "文字コードを判別できませんでした（UTF-8 / Shift-JIS に対応しています）"

        # 列チェック
        missing = [c for c in CSV_COLUMNS if c not in df.columns]
        if missing:
            return False, f"必要な列が不足しています: {missing}"

        df = df[CSV_COLUMNS].copy()
        df["歌唱順"] = pd.to_numeric(df["歌唱順"], errors="coerce").fillna(0).astype(int)
        df["配信日"] = pd.to_datetime(df["配信日"]).dt.strftime("%Y-%m-%d")
        df["枠URL"] = df["枠URL"].fillna("")
        df["コラボ相手様"] = df["コラボ相手様"].fillna("なし")

        conn = get_conn()
        c = conn.cursor()

        # ── 完全上書き ──
        c.execute("DELETE FROM setlists")
        c.execute("DELETE FROM streams")
        c.execute("DELETE FROM songs")
        c.execute("DELETE FROM sqlite_sequence WHERE name IN ('setlists','streams','songs')")

        for _, row in df.iterrows():
            # streams（重複なし）
            c.execute(
                "INSERT OR IGNORE INTO streams (title, stream_date, archive_url) VALUES (?,?,?)",
                (row["枠名"], row["配信日"], row["枠URL"] or None)
            )
            c.execute(
                "SELECT stream_id FROM streams WHERE title=? AND stream_date=?",
                (row["枠名"], row["配信日"])
            )
            stream_id = c.fetchone()[0]

            # songs（重複なし）
            c.execute(
                "INSERT OR IGNORE INTO songs (title) VALUES (?)",
                (row["楽曲名"],)
            )
            c.execute("SELECT song_id FROM songs WHERE title=?", (row["楽曲名"],))
            song_id = c.fetchone()[0]

            # setlists
            c.execute(
                "INSERT INTO setlists (stream_id, song_id, order_in_stream, song_url, collab) VALUES (?,?,?,?,?)",
                (stream_id, song_id, row["歌唱順"], row["枠URL"] or None, row["コラボ相手様"])
            )

        conn.commit()
        conn.close()
        return True, f"{len(df)} 件のレコードをインポートしました。"

    except Exception as e:
        return False, f"エラー: {e}"

# ─────────────────────────────────────────
# ページ：データ管理（Import / Export）
# ─────────────────────────────────────────
def page_data_management():
    st.header("🔄 データ管理")

    col_ex, col_im = st.columns(2)

    # ── エクスポート ──
    with col_ex:
        st.subheader("📤 エクスポート")
        st.markdown("現在のDBの内容をCSV形式でダウンロードします。")
        csv_bytes = export_csv()
        st.download_button(
            label="⬇️ CSVダウンロード",
            data=csv_bytes,
            file_name="streaming_info.csv",
            mime="text/csv",
            use_container_width=True,
        )

    # ── インポート ──
    with col_im:
        st.subheader("📥 インポート（完全上書き）")
        st.warning(
            "⚠️ インポートすると既存データはすべて削除され、CSVの内容に置き換えられます。",
            icon="⚠️",
        )
        uploaded = st.file_uploader(
            "CSVファイルを選択（UTF-8 / Shift-JIS）",
            type=["csv"],
            key="import_csv",
        )
        if uploaded:
            if st.button("🔁 インポート実行", use_container_width=True, type="primary"):
                ok, msg = import_csv(uploaded)
                if ok:
                    st.success(msg)
                    st.rerun()
                else:
                    st.error(msg)

    # ── CSVフォーマット説明 ──
    st.divider()
    st.subheader("📋 CSVフォーマット")
    st.markdown("エクスポートされるCSV（追記してインポートする形式）の列構成：")
    st.dataframe(
        pd.DataFrame({
            "列名": CSV_COLUMNS,
            "例": [
                "【初配信】初めまして、妃玖です。",
                "メビウス",
                "1",
                "2026-01-01",
                "https://www.youtube.com/live/xxxxx",
                "なし",
            ],
        }),
        use_container_width=True,
        hide_index=True,
    )

# ─────────────────────────────────────────
# ページ：配信枠
# ─────────────────────────────────────────
def page_streams():
    st.header("📋 配信枠一覧")

    # 枠登録フォーム
    with st.expander("＋ 配信枠を追加（手動）"):
        with st.form("add_stream"):
            title    = st.text_input("枠名")
            date     = st.date_input("配信日")
            url      = st.text_input("アーカイブURL（任意）")
            submitted = st.form_submit_button("登録")
            if submitted and title:
                execute(
                    "INSERT OR IGNORE INTO streams (title, stream_date, archive_url) VALUES (?,?,?)",
                    (title, str(date), url or None)
                )
                st.success("登録しました！")
                st.rerun()

    streams_df = fetch_df("SELECT * FROM streams ORDER BY stream_date DESC")

    if streams_df.empty:
        st.info("配信枠がまだ登録されていません。")
        return

    streams_df.columns = ["ID", "枠名", "配信日", "アーカイブURL"]

    # 枠選択
    selected = st.selectbox(
        "枠を選択してセトリを表示",
        streams_df["ID"].tolist(),
        format_func=lambda i: (
            f"{streams_df.loc[streams_df['ID']==i, '配信日'].values[0]}  "
            f"{streams_df.loc[streams_df['ID']==i, '枠名'].values[0]}"
        )
    )

    # 枠情報表示
    row = streams_df[streams_df["ID"] == selected].iloc[0]
    st.markdown(f"**{row['枠名']}** ／ {row['配信日']}")
    if row["アーカイブURL"]:
        st.markdown(f"🔗 [{row['アーカイブURL']}]({row['アーカイブURL']})")

    # セトリ表示
    st.subheader("セットリスト")
    setlist_df = fetch_df("""
        SELECT sl.order_in_stream AS 歌唱順,
               s.title            AS 楽曲名,
               sl.collab          AS コラボ相手様,
               sl.song_url        AS 楽曲URL
        FROM setlists sl
        JOIN songs s ON sl.song_id = s.song_id
        WHERE sl.stream_id = ?
        ORDER BY sl.order_in_stream
    """, (selected,))

    if setlist_df.empty:
        st.info("この枠にはまだ曲が登録されていません。")
    else:
        st.dataframe(setlist_df, use_container_width=True, hide_index=True)

    # セトリ追加フォーム
    with st.expander("＋ 曲をセトリに追加（手動）"):
        songs_df = fetch_df("SELECT song_id, title FROM songs ORDER BY title")
        if songs_df.empty:
            st.warning("先に曲マスターへ曲を登録してください。")
        else:
            with st.form("add_setlist"):
                song_choice = st.selectbox(
                    "曲を選択",
                    songs_df["song_id"].tolist(),
                    format_func=lambda i: songs_df.loc[songs_df["song_id"]==i, "title"].values[0]
                )
                order  = st.number_input("歌唱順（任意）", min_value=1, value=1)
                collab = st.text_input("コラボ相手様（なし の場合そのまま）", value="なし")
                s_url  = st.text_input("楽曲URL（タイムスタンプ付き、任意）")
                submitted = st.form_submit_button("追加")
                if submitted:
                    execute(
                        "INSERT INTO setlists (stream_id, song_id, order_in_stream, song_url, collab) VALUES (?,?,?,?,?)",
                        (selected, song_choice, order, s_url or None, collab or "なし")
                    )
                    st.success("追加しました！")
                    st.rerun()

# ─────────────────────────────────────────
# ページ：曲
# ─────────────────────────────────────────
def page_songs():
    st.header("🎵 曲一覧 & 統計")

    # 曲登録フォーム
    with st.expander("＋ 曲を追加（手動）"):
        with st.form("add_song"):
            title     = st.text_input("曲名")
            artist    = st.text_input("原曲アーティスト")
            lyricist  = st.text_input("作詞")
            composer  = st.text_input("作曲")
            submitted = st.form_submit_button("登録")
            if submitted and title:
                execute(
                    "INSERT OR IGNORE INTO songs (title, artist, lyricist, composer) VALUES (?,?,?,?)",
                    (title, artist or None, lyricist or None, composer or None)
                )
                st.success("登録しました！")
                st.rerun()

    # 歌唱回数集計
    count_df = fetch_df("""
        SELECT s.title       AS 楽曲名,
               s.artist      AS 原曲アーティスト,
               COUNT(sl.id)  AS 歌唱回数
        FROM songs s
        LEFT JOIN setlists sl ON s.song_id = sl.song_id
        GROUP BY s.song_id
        ORDER BY 歌唱回数 DESC
    """)

    if count_df.empty:
        st.info("曲がまだ登録されていません。")
        return

    # テーブル表示
    st.dataframe(count_df, use_container_width=True, hide_index=True)

    # グラフ（歌唱回数 上位20曲）
    st.subheader("歌唱回数ランキング（上位20曲）")
    top20 = count_df[count_df["歌唱回数"] > 0].head(20)
    if top20.empty:
        st.info("まだセトリにデータがありません。")
    else:
        fig = px.bar(
            top20,
            x="歌唱回数",
            y="楽曲名",
            orientation="h",
            color="歌唱回数",
            color_continuous_scale="Blues",
            hover_data=["原曲アーティスト"],
        )
        fig.update_layout(
            yaxis=dict(autorange="reversed"),
            coloraxis_showscale=False,
            height=max(400, len(top20) * 28),
        )
        st.plotly_chart(fig, use_container_width=True)

# ─────────────────────────────────────────
# メイン
# ─────────────────────────────────────────
def main():
    st.set_page_config(
        page_title="妃玖 歌ってみたDB",
        page_icon="🎤",
        layout="wide"
    )
    init_db()

    # ─── バナー画像 ───
    BANNER_URL = (
        "https://yt3.googleusercontent.com/u3MLvApeviPLt_-RPfqiPB1ZPeEtaBknWDv-jKyzMGEijRaireQ2zfxK1HmkuDtJpUIW_uVXxEY"
        "=w1707-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj"
    )
    st.image(BANNER_URL, use_container_width=True)

    st.title("🎤 妃玖 歌ってみたDB")

    # ─── サイドバー ───
    st.sidebar.markdown(
        """
        <div style="text-align:center; line-height:1.6; padding-bottom:8px;">
            <span style="font-size:1.05rem; font-weight:bold;">
                🐍⚜🎶芋虫羽虫㌠の部屋🎶⚜🐍
            </span><br>
            <span style="font-size:0.85rem; color:#aaa;">▼ menu</span>
        </div>
        """,
        unsafe_allow_html=True,
    )

    page = st.sidebar.radio(
        label="",
        options=["配信枠", "曲一覧 & 統計", "データ管理"],
        format_func=lambda x: {
            "配信枠":        "📺 LiveStreaming Info",
            "曲一覧 & 統計": "🎵 Uta-Mita DB",
            "データ管理":    "🔄 Data Management",
        }[x],
    )

    if page == "配信枠":
        page_streams()
    elif page == "曲一覧 & 統計":
        page_songs()
    else:
        page_data_management()

if __name__ == "__main__":
    main()
