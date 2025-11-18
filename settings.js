// settings.js: منطق حفظ وتحديث أسعار الصرف وحذف قاعدة البيانات

// الدوال putData, loadRates, showNotification, deleteDB يتم تحميلها من core_logic.js

const saveRatesBtn = document.getElementById('save-rates-btn');
const deleteDbBtn = document.getElementById('delete-db-btn');
const usdRateInput = document.getElementById('usd-rate-input');
const sarRateInput = document.getElementById('sar-rate-input');
const goldPriceInput = document.getElementById('gold-price-input'); // هو سعر جرام عيار 24
const lastUpdateEl = document.getElementById('last-update');


// ----------------------------------------------------
// 1. وظيفة تحميل وعرض الأسعار (مع تصحيح المشكلة)
// ----------------------------------------------------
async function loadAndPopulateRates() {
    // ✅ تم التعديل هنا: تحميل الأسعار مباشرة من قاعدة البيانات
    await loadRates(); 
    
    // عرض القيم المحملة
    usdRateInput.value = currentRates.USD_TO_YER;
    sarRateInput.value = currentRates.SAR_TO_YER;
    // التأكد من أن حقل الذهب يعرض قيمة عيار 24 المخزنة
    goldPriceInput.value = currentRates.GOLD_PER_GRAM_YER; 

    lastUpdateEl.textContent = 'آخر تحديث: ' + new Date().toLocaleTimeString('ar-EG', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}


// ----------------------------------------------------
// 2. وظيفة حفظ الأسعار وتحديث الأصول
// ----------------------------------------------------
async function saveRates() {
    const usdRate = parseFloat(usdRateInput.value);
    const sarRate = parseFloat(sarRateInput.value);
    const goldPrice = parseFloat(goldPriceInput.value);
    
    if (isNaN(usdRate) || isNaN(sarRate) || isNaN(goldPrice) || usdRate <= 0 || sarRate <= 0 || goldPrice <= 0) {
        showNotification('❌ يرجى إدخال قيم صحيحة وموجبة لجميع الأسعار.', true);
        return;
    }
    
    // القيم المراد حفظها في قاعدة البيانات
    const ratesToSave = [
        { key: 'USD_TO_YER', value: usdRate.toString() },
        { key: 'SAR_TO_YER', value: sarRate.toString() },
        { key: 'GOLD_PER_GRAM_YER', value: goldPrice.toString() } // حفظ سعر عيار 24
    ];

try {
    // حفظ كل سعر كعنصر منفصل في مخزن 'rates'
    const savePromises = ratesToSave.map(rate => putData('rates', rate));
    await Promise.all(savePromises);

    // 🟡 حفظ وقت آخر تحديث داخل قاعدة البيانات
    await putData('rates', { key: 'LAST_UPDATE', value: Date.now() });

    // إعادة تحميل الأسعار في الذاكرة لتحديث currentRates
    await loadRates(); 

    showNotification('✅ تم حفظ الأسعار بنجاح! سيتم تحديث جميع الأرصدة والديون.', false);

    lastUpdateEl.textContent = 'آخر تحديث: ' + new Date().toLocaleTimeString('ar-EG', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

} catch (error) {
    showNotification('❌ حدث خطأ أثناء محاولة حفظ الأسعار.', true);
    console.error('Save Rates Error:', error);
}
}
// ----------------------------------------------------
// 3. وظيفة حذف قاعدة البيانات بالكامل
// ----------------------------------------------------
async function handleDeleteDatabase() {
    if (confirm("هل أنت متأكد تماماً من حذف جميع البيانات (البنوك، الديون، الأسعار)؟ لا يمكن التراجع عن هذا الإجراء.")) {
        try {
            await deleteDB();
            // مسح قيم الذهب من localStorage عند الحذف الكامل
            localStorage.removeItem('gold_grams_24'); 
            localStorage.removeItem('gold_grams_21'); 

            showNotification('🗑️ تم حذف قاعدة البيانات بالكامل بنجاح. سيتم إعادة تحميل الصفحة للبدء من جديد.', false);
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            showNotification('❌ فشل حذف قاعدة البيانات. تحقق من Console.', true);
            console.error(error);
        }
    }
}

//-----------------------------\
// ربط أزرار النسخ الاحتياطي والاستعادة
//-----------------------------\
document.getElementById("exportBackupBtn")?.addEventListener("click", exportBackup);

document.getElementById("importBackupBtn")?.addEventListener("click", () => {
    document.getElementById("importBackupInput").click();
});

document.getElementById("importBackupInput")?.addEventListener("change", handleImportBackup);

// ----------------------------------------------------
// 4. وظيفة استعادة النسخة الاحتياطية
// ----------------------------------------------------
async function handleImportBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const backup = JSON.parse(text);

        // استعادة البيانات لكل store
        for (let storeName of Object.keys(backup)) {
            const dataArray = backup[storeName];
            if (Array.isArray(dataArray)) {
                for (let item of dataArray) {
                    await putData(storeName, item);
                }
            }
        }

        showNotification("✅ تم استعادة النسخة الاحتياطية بنجاح");

    } catch (error) {
        console.error(error);
        showNotification("❌ فشل في استعادة النسخة الاحتياطية", true);
    }

    event.target.value = "";
}

// ----------------------------------------------------\
// 5. بدء التشغيل وربط الأزرار
// ----------------------------------------------------\
document.addEventListener('DOMContentLoaded', () => {
    loadAndPopulateRates();
    saveRatesBtn.addEventListener('click', saveRates);
    deleteDbBtn.addEventListener('click', handleDeleteDatabase);
});
document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("autoBackupToggle");

    // تحميل حالة الزر
    toggle.checked = isAutoBackupEnabled();

    toggle.addEventListener("change", () => {
        setAutoBackupEnabled(toggle.checked);

        if (toggle.checked) {
            showNotification("✔️ تم تفعيل النسخ الاحتياطي التلقائي");
            checkAndRunAutoBackup(); // يعمل فورًا أول مرة
        } else {
            showNotification("⛔ تم إيقاف النسخ الاحتياطي التلقائي");
        }
    });
});
