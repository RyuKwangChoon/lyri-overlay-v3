<template>
  <div class="notice-admin">
    <header>
      <h1>🎛 Lyri Notice Admin v1.0</h1>
      <p class="muted">타이틀/공지(상·하단) 문구를 등록하고 활성화 상태를 저장합니다.</p>
    </header>

    <section class="card full">
      <h2>➕ 새 문구 등록</h2>
      <div class="controls">
        <select v-model="slot">
          <option value="title">타이틀</option>
          <option value="top">공지 1 (상단)</option>
          <option value="bottom">공지 2 (하단)</option>
        </select>
        <textarea v-model="text" placeholder="HTML 허용. 예) 📢 <b style='color:gold'>구독</b> 부탁드립니다."></textarea>
        <button class="primary" @click="addNotice">추가</button>
        <span class="muted">{{ addStatus }}</span>
      </div>
    </section>

    <div class="grid">
      <section class="card">
        <h2>📝 등록된 문구 (체크 = 활성)</h2>
        <div class="list">
          <div
            v-for="item in list"
            :key="item.id"
            class="row"
          >
            <input type="checkbox" v-model="activeIds" :value="item.id" />
            <span class="slot">{{ item.slot }}</span>
            <span class="text" v-html="sanitize(item.text)"></span>
          </div>
        </div>
        <div class="controls">
          <button class="primary" @click="saveActive">활성 상태 저장</button>
          <span class="muted">{{ saveStatus }}</span>
        </div>
      </section>

      <section class="card">
        <h2>🔎 현재 활성 상태 (미리보기)</h2>
        <div class="list">
          <template v-for="slot in ['title','top','bottom']" :key="slot">
            <div v-for="(txt, i) in preview[slot]" :key="i" class="row">
              <span class="slot">{{ slot }}</span>
              <span class="text" v-html="sanitize(txt)"></span>
            </div>
          </template>
        </div>
        <div class="controls">
          <button @click="refreshActive">새로고침</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8787";
const TOKEN = import.meta.env.VITE_AUTH_TOKEN || "lyri_secret_1234";
const headers = { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` };

// reactive state
const slot = ref("top");
const text = ref("");
const list = ref([]);
const activeIds = ref([]);
const preview = ref({ title: [], top: [], bottom: [] });
const addStatus = ref("");
const saveStatus = ref("");

// === util ===
function sanitize(html) {
  // prevent injection for preview
  return html.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// === API ===
async function apiList() {
  const r = await fetch(`${API_BASE}/notice/list`);
  return await r.json();
}
async function apiAdd(text, slot) {
  const r = await fetch(`${API_BASE}/notice/add`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text, slot }),
  });
  return await r.json();
}
async function apiSaveActive(ids) {
  const r = await fetch(`${API_BASE}/notice/updateActive`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ids }),
  });
  return await r.json();
}
async function apiActive() {
  const r = await fetch(`${API_BASE}/notice/active`);
  return await r.json();
}

// === logic ===
async function loadList() {
  list.value = await apiList();
  activeIds.value = list.value.filter(x => x.is_active === "Y").map(x => x.id);
}
async function addNotice() {
  if (!text.value.trim()) {
    addStatus.value = "⚠️ 문구를 입력하세요";
    return;
  }
  addStatus.value = "⏳ 저장 중...";
  const res = await apiAdd(text.value, slot.value);
  addStatus.value = res.ok ? "✅ 추가 완료" : "❌ 실패";
  await loadList();
  text.value = "";
}
async function saveActive() {
  saveStatus.value = "⏳ 반영 중...";
  const res = await apiSaveActive(activeIds.value);
  saveStatus.value = res.ok ? "✅ 저장 완료" : "❌ 실패";
  await refreshActive();
}
async function refreshActive() {
  preview.value = await apiActive();
}

onMounted(async () => {
  await loadList();
  await refreshActive();
});
</script>

<style scoped>
.notice-admin {
  background: #0b0b0c;
  color: #e9e9ee;
  font-family: system-ui, -apple-system, 'Noto Sans KR', sans-serif;
  padding: 1rem 2rem 4rem;
  min-height: 100vh;
}
header {
  padding-bottom: 1rem;
  border-bottom: 1px solid #2a2f39;
  margin-bottom: 1.5rem;
}
h1 {
  margin: 0;
  color: #00e5ff;
  font-size: 1.4rem;
}
h2 {
  color: #cdd8ff;
  font-size: 1.1rem;
  margin-bottom: 0.6rem;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}
.card {
  background: #14161e;
  border: 1px solid #2a2f39;
  border-radius: 10px;
  padding: 1rem;
}
.card.full {
  grid-column: 1 / -1;
}
.list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #2a2f39;
  border-radius: 8px;
  background: #0f1117;
  padding: 0.5rem;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 4px 0;
  border-bottom: 1px dashed #222;
}
.row:last-child { border-bottom: none; }
.slot {
  font-size: 0.8rem;
  color: #8aa0ff;
  background: #141827;
  border: 1px solid #2a2f39;
  padding: 0 6px;
  border-radius: 999px;
}
.text {
  color: #ddd;
  font-size: 0.9rem;
}
.controls {
  margin-top: 0.6rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
input[type="text"], textarea, select {
  background: #0f1117;
  color: #e9e9ee;
  border: 1px solid #2a2f39;
  border-radius: 6px;
  padding: 0.4rem;
  width: 100%;
}
textarea { min-height: 80px; }
button {
  border-radius: 6px;
  border: 1px solid #2a2f39;
  background: #0f1117;
  color: #e9e9ee;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}
button.primary {
  background: #0d2bff;
  border-color: #2241ff;
}
button:hover {
  background: #1a1f2c;
}
.muted {
  font-size: 0.8rem;
  color: #9aa3b2;
}
</style>
