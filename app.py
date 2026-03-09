import streamlit as st
import pandas as pd
import plotly.express as px
import sqlite3
import os

DB_PATH = "utawaku.db"

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
            archive_url TEXT
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS songs (
            song_id     INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            artist      TEXT,
            lyricist    TEXT,
            composer    TEXT
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS setlists (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            stream_id   INTEGER NOT NULL,
            song_id     INTEGER NOT NULL,
            order_in_stream INTEGER,
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
# ページ：配信枠
# ─────────────────────────────────────────
def page_streams():
    st.header("📋 配信枠一覧")

    # 枠登録フォーム
    with st.expander("＋ 配信枠を追加"):
        with st.form("add_stream"):
            title    = st.text_input("枠名")
            date     = st.date_input("配信日")
            url      = st.text_input("アーカイブURL（任意）")
            submitted = st.form_submit_button("登録")
            if submitted and title:
                execute(
                    "INSERT INTO streams (title, stream_date, archive_url) VALUES (?,?,?)",
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
        format_func=lambda i: streams_df.loc[streams_df["ID"]==i, "枠名"].values[0]
    )

    # 枠情報表示
    row = streams_df[streams_df["ID"] == selected].iloc[0]
    st.markdown(f"**{row['枠名']}** ／ {row['配信日']}")
    if row["アーカイブURL"]:
        st.markdown(f"🔗 [{row['アーカイブURL']}]({row['アーカイブURL']})")

    # セトリ表示
    st.subheader("セットリスト")
    setlist_df = fetch_df("""
        SELECT sl.order_in_stream AS 順番,
               s.title            AS 曲名,
               s.artist           AS 原曲アーティスト,
               s.lyricist         AS 作詞,
               s.composer         AS 作曲
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
    with st.expander("＋ 曲をセトリに追加"):
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
                order = st.number_input("順番（任意）", min_value=1, value=1)
                submitted = st.form_submit_button("追加")
                if submitted:
                    execute(
                        "INSERT INTO setlists (stream_id, song_id, order_in_stream) VALUES (?,?,?)",
                        (selected, song_choice, order)
                    )
                    st.success("追加しました！")
                    st.rerun()

# ─────────────────────────────────────────
# ページ：曲
# ─────────────────────────────────────────
def page_songs():
    st.header("🎵 曲一覧 & 統計")

    # 曲登録フォーム
    with st.expander("＋ 曲を追加"):
        with st.form("add_song"):
            title     = st.text_input("曲名")
            artist    = st.text_input("原曲アーティスト")
            lyricist  = st.text_input("作詞")
            composer  = st.text_input("作曲")
            submitted = st.form_submit_button("登録")
            if submitted and title:
                execute(
                    "INSERT INTO songs (title, artist, lyricist, composer) VALUES (?,?,?,?)",
                    (title, artist or None, lyricist or None, composer or None)
                )
                st.success("登録しました！")
                st.rerun()

    # 歌唱回数集計
    count_df = fetch_df("""
        SELECT s.title       AS 曲名,
               s.artist      AS 原曲アーティスト,
               s.lyricist    AS 作詞,
               s.composer    AS 作曲,
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
            y="曲名",
            orientation="h",
            color="歌唱回数",
            color_continuous_scale="Blues",
            hover_data=["原曲アーティスト", "作詞", "作曲"],
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
        options=["配信枠", "曲一覧 & 統計"],
        format_func=lambda x: "📺 LiveStreaming Info" if x == "配信枠" else "🎵 Uta-Mita DB",
    )

    if page == "配信枠":
        page_streams()
    else:
        page_songs()

if __name__ == "__main__":
    main()
