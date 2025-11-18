// core_logic.js: المنطق المشترك لقاعدة البيانات وأسعار الصرف والإشعارات (النسخة النهائية والمستقرة)

const DB_NAME = 'FinanceDB';
const DB_VERSION = 1;
let db;

// الأسعار الافتراضية
let currentRates = {
    'USD_TO_YER': 1630,        
    'SAR_TO_YER': 428,         
    'GOLD_PER_GRAM_YER': 217000 
};

let ratesLoadedPromise = new Promise(resolve => resolve(true)); 

// ===============================================
// تخزين حالة النسخ الاحتياطي التلقائي (ON / OFF)
// ===============================================
function isAutoBackupEnabled() {
    return localStorage.getItem("autoBackup") === "1";
}

function setAutoBackupEnabled(state) {
    localStorage.setItem("autoBackup", state ? "1" : "0");
}

// ----------------------------------------------------
// 1. دوال IndexedDB الأساسية
// ----------------------------------------------------

function openDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => { console.error("IndexedDB error:", event.target.errorCode); reject('Failed to open DB'); };
        request.onsuccess = (event) => { db = event.target.result; resolve(db); };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // إنشاء مخازن البيانات
            if (!db.objectStoreNames.contains('assets')) {
                db.createObjectStore('assets', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('debts')) {
                db.createObjectStore('debts', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('rates')) {
                db.createObjectStore('rates', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('backups')) {
                db.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
	    }
        };
    });
}

function deleteDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            db.close();
            db = null;
        }
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

        deleteRequest.onsuccess = () => {
            console.log("Database deleted successfully");
            resolve(true);
        };
        deleteRequest.onerror = (event) => {
            console.error("Error deleting database:", event.target.error);
            reject(event.target.error);
        };
    });
}

// دالة الحفظ
async function putData(storeName, data) {
    await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        transaction.oncomplete = () => {
             console.log(`✅ IndexedDB: Data put successfully to ${storeName}:`, data);
             resolve(request.result); 
        }
        
        transaction.onerror = (event) => {
            console.error(`❌ IndexedDB: Error putting data to ${storeName}:`, event.target.error);
            reject(event.target.error);
        };
    });
}
// إرجاع عنصر واحد من مخزن معين باستخدام ID
async function getData(storeName, id) {
    if (!id) return null;

    await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = (event) => reject(event.target.error);
    });
}
async function getAllData(storeName) {
    await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// ----------------------------------------------------
// 🔧 دالة حذف عنصر واحد (مضافة فقط للديون دون تعديل أي شيء آخر)
// ----------------------------------------------------
async function deleteData(storeName, id) {
    if (!id) return false;
    await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => {
            console.log(`🗑️ Deleted item ${id} from ${storeName}`);
            resolve(true);
        };

        request.onerror = (event) => {
            console.error(`❌ Failed to delete item ${id} from ${storeName}`, event.target.error);
            reject(event.target.error);
        };
    });
}

// ❌ تم إزالة دالة deleteBulkData لأنها لم تكن موثوقة في بعض البيئات
// ------------------------------------------------------------------
// 🆕 دالة الحذف الجماعي (الأكثر موثوقية)
// ------------------------------------------------------------------
async function deleteBulkData(storeName, ids) {
    if (!ids || ids.length === 0) return true;
    await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        ids.forEach(id => {
            store.delete(id); 
        });

        transaction.oncomplete = () => {
             console.log(`✅ IndexedDB: Bulk delete successful from ${storeName}, IDs count: ${ids.length}`);
             resolve(true);
        };
        transaction.onerror = (event) => {
            console.error(`❌ IndexedDB: Error in bulk delete from ${storeName}:`, event.target.error);
            reject(event.target.error);
        };
    });
}
async function exportBackup() {
    try {
        const db = await openDB();

        const stores = ['assets', 'debts', 'rates'];

        let backup = {};

        for (let store of stores) {
            backup[store] = await getAllData(store);
        }

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        const now = new Date();
const timestamp = `${now.getFullYear()}-${
    String(now.getMonth() + 1).padStart(2, '0')
}-${
    String(now.getDate()).padStart(2, '0')
}_${
    String(now.getHours()).padStart(2, '0')
}-${
    String(now.getMinutes()).padStart(2, '0')
}`;

link.download = `wallet_backup_${timestamp}.json`;
        link.click();

        URL.revokeObjectURL(url);
        showNotification("✅ تم تصدير النسخة الاحتياطية بنجاح");
    } catch (e) {
        console.error(e);
        showNotification("❌ فشل في إنشاء النسخة الاحتياطية", true);
    }
}

// ----------------------------------------------------
// 2. دوال التحويل والأسعار
// ----------------------------------------------------

function convertToYER(value, currency, type) {
    if (type === 'gold') {
        return value * currentRates.GOLD_PER_GRAM_YER;
    }
    
    if (currency === 'YER') {
        return value;
    } else if (currency === 'USD') {
        return value * currentRates.USD_TO_YER;
    } else if (currency === 'SAR') {
        return value * currentRates.SAR_TO_YER;
    }
    return 0;
}

function convertYERToSAR(yerValue) {
    return yerValue / currentRates.SAR_TO_YER;
}

function loadRates() {
    return new Promise(async (resolve, reject) => {
        try {
            const ratesArray = await getAllData('rates'); 
            
            if (ratesArray.length > 0) {
                ratesArray.forEach(rate => {
                    const rateValue = parseFloat(rate.value); 
                    if (rate.key === 'USD_TO_YER') {
                        currentRates.USD_TO_YER = rateValue;
                    } else if (rate.key === 'SAR_TO_YER') {
                        currentRates.SAR_TO_YER = rateValue;
                    } else if (rate.key === 'GOLD_PER_GRAM_YER') {
                        currentRates.GOLD_PER_GRAM_YER = rateValue;
                    }
                });

                // قراءة وقت آخر تحديث
                const lastUpdateEntry = ratesArray.find(r => r.key === 'LAST_UPDATE');
                window.lastRatesUpdate =
                    lastUpdateEntry ? new Date(parseInt(lastUpdateEntry.value)) : null;

                console.log('💰 Rates + Last update loaded:', currentRates, window.lastRatesUpdate);
            } else {
                console.log('⚠️ No rates found in DB, using defaults:', currentRates);
            }
            resolve(true); 
        } catch (e) {
            console.warn("Could not load rates, using defaults.", e);
            resolve(false); 
        }
    });
}


function waitForRates() {
    return loadRates();
}

// ----------------------------------------------------
// 3. دالة الإشعارات المخصصة 
// ----------------------------------------------------

function showNotification(message, isError = false) {
    const notificationContainer = document.querySelector('.notification-container');
    if (!notificationContainer) return console.error('Notification container missing.');

    const notif = document.createElement('div');
    notif.className = `custom-notification ${isError ? 'error' : 'success'}`;
    notif.textContent = message;

    notificationContainer.appendChild(notif);
    
    setTimeout(() => notif.classList.add('show'), 10);

    setTimeout(() => {
        notif.classList.remove('show');
        setTimeout(() => notif.remove(), 500);
    }, 3000);
}

// ----------------------------------------------------
// 4. نقطة البداية عند تحميل الملف
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    await openDB();
    await loadRates();

    // تشغيل النسخ التلقائي فقط إذا كان مفعّلاً
    if (isAutoBackupEnabled()) {
        checkAndRunAutoBackup();
    }
});