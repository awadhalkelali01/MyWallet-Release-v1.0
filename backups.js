// backups.js — إدارة النسخ الاحتياطية داخل IndexedDB

// مخزن جديد للنسخ الاحتياطية
const BACKUP_STORE = "backups";

// إنشاء المخزن إذا لم يكن موجود
indexedDB.open(DB_NAME, DB_VERSION).onupgradeneeded = function (event) {
    const db = event.target.result;
    if (!db.objectStoreNames.contains(BACKUP_STORE)) {
        db.createObjectStore(BACKUP_STORE, { keyPath: "id", autoIncrement: true });
    }
};

// حفظ نسخة داخل القاعدة
async function saveInternalBackup() {
    const stores = ["assets", "debts", "rates"];
    let backup = {};

    for (let store of stores) {
        backup[store] = await getAllData(store);
    }

    backup.timestamp = Date.now();

    await putData(BACKUP_STORE, backup);
    showNotification("📦 تم إنشاء النسخة الاحتياطية الداخلية بنجاح");
}

// تحميل قائمة النسخ
async function loadBackups() {
    const list = document.getElementById("backupList");
    const backups = await getAllData(BACKUP_STORE);

    list.innerHTML = "";

    if (backups.length === 0) {
        list.innerHTML = `<p style="text-align:center;color:var(--muted);margin-top:20px;">لا توجد نسخ محفوظة بعد.</p>`;
        return;
    }

    // الأحدث أولاً
    backups.sort((a,b)=>b.timestamp - a.timestamp);

    backups.forEach(backup => {
        const date = new Date(backup.timestamp).toLocaleString("ar-EG");

        const li = document.createElement("li");
        li.className = "list-item";

        li.innerHTML = `
            <div>
                <strong>📄 نسخة بتاريخ:</strong>
                <p>${date}</p>
            </div>

            <div style="display:flex;gap:10px;">
                <button class="btn primary btn-small" data-id="${backup.id}" data-action="restore">استعادة</button>
                <button class="btn cancel btn-small" data-id="${backup.id}" data-action="download">تنزيل</button>
                <button class="btn cancel btn-small" data-id="${backup.id}" data-action="delete">حذف</button>
            </div>
        `;

        list.appendChild(li);
    });
}

// تنزيل نسخة داخلية كملف
async function downloadBackup(id) {
    const backup = await getData(BACKUP_STORE, id);
    if (!backup) return;

    const data = {...backup};
    delete data.id;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const timestamp = new Date(backup.timestamp).toISOString().replace(/[:]/g,"-").replace("T","_").substring(0,16);

    a.href = url;
    a.download = `wallet_internal_backup_${timestamp}.json`;
    a.click();

    URL.revokeObjectURL(url);
}

// استعادة نسخة داخلية
async function restoreInternalBackup(id) {
    const backup = await getData(BACKUP_STORE, id);
    if (!backup) return;

    const stores = ["assets", "debts", "rates"];

    for (let store of stores) {
        const dataArray = backup[store] || [];
        for (let item of dataArray) {
            await putData(store, item);
        }
    }

    showNotification("🔄 تم استعادة النسخة الداخلية بنجاح");
}

// حذف نسخة
async function deleteBackup(id) {
    await deleteData(BACKUP_STORE, id);
    loadBackups();
    showNotification("🗑️ تم حذف النسخة بنجاح");
}

// ربط الأزرار
document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("createBackupBtn").addEventListener("click", async () => {
        await saveInternalBackup();
        loadBackups();
    });

    document.getElementById("backupList").addEventListener("click", async (e) => {
        const id = Number(e.target.dataset.id);
        const action = e.target.dataset.action;

        if (!id || !action) return;

        if (action === "restore") restoreInternalBackup(id);
        if (action === "download") downloadBackup(id);
        if (action === "delete") deleteBackup(id);
    });

    loadBackups();
});
