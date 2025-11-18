// app.js: منطق عرض إجمالي الأصول في لوحة التحكم الرئيسية

// الدوال: getAllData, convertToYER, currentRates, waitForRates, showNotification
// مُحمّلة مسبقاً من db_logic.js

const showDuration = 100; 
const cards = Array.from(document.querySelectorAll('.card'));
const updateLink = document.getElementById('updateLink');

// عناصر عرض المبالغ
const totalYerEl = document.getElementById('total-yer');
const totalSarEl = document.getElementById('total-sar');
const totalUsdEl = document.getElementById('total-usd');

// ------------------------------------------------------------------
// 1. منطق عرض البيانات
// ------------------------------------------------------------------

/**
 * يحسب ويُحدّث إجمالي الأرصدة.
 */
async function displayTotalAssets() {
    // 1. التأكد من تحميل الأسعار
    await waitForRates(); 
    
    // 2. جلب الأصول
    const assets = await getAllData('assets');
    
    let totalYER = 0;
    
    assets.forEach(asset => {
        // تحويل قيمة كل أصل إلى الريال اليمني (YER)
        totalYER += convertToYER(asset.value, asset.currency, asset.type);
    });

    // 3. تحويل الإجمالي إلى العملات الأخرى
    const totalUSD = totalYER / currentRates.USD_TO_YER;
    const totalSAR = totalYER / currentRates.SAR_TO_YER;

    // 4. عرض القيم في الواجهة
    totalYerEl.textContent = totalYER.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' YER';
    totalSarEl.textContent = totalSAR.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' SAR';
    totalUsdEl.textContent = totalUSD.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' USD';
}

// ------------------------------------------------------------------
// 2. منطق شاشة البداية (Splash) والتحميل
// ------------------------------------------------------------------

function startCardsSequence(){
    cards.forEach((c, i) => {
      c.style.opacity = '1'; 
      c.style.transform = 'translateY(0)'; // تعديل بسيط ليتناسب مع الانتقالات
      c.style.transition = 'opacity .45s ease, transform .45s ease';
    });
    // إظهار رابط التحديث
    if(updateLink) {
        updateLink.style.opacity = '1';
        updateLink.style.transform = 'translateY(0)';
    }
}

function handleLoadSequence() {
    const splash = document.getElementById('splash');
    
    setTimeout(async ()=>{

        if(splash) {
            splash.style.transition = 'opacity 0.6s ease, visibility 0.6s ease';
            splash.style.opacity = '0';
            setTimeout(()=> splash.remove(), 600);
        }

        // تحميل الأرصدة
        await displayTotalAssets();

        // تحديث وقت آخر تحديث
        await updateLastUpdateLabels();

        // إظهار البطاقات
        startCardsSequence();

    }, showDuration);
}


// ------------------------------------------------------------------
// بدء التشغيل
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', handleLoadSequence);
async function updateLastUpdateLabels() {
    try {
        const rates = await getAllData('rates');
        const lastUpdate = rates.find(r => r.key === 'LAST_UPDATE');

        const labels = document.querySelectorAll('.card-update');

        if (!lastUpdate || labels.length === 0) return;

        const date = new Date(lastUpdate.value);

        const formatted = date.toLocaleString("ar-EG", {
            hour: "2-digit",
            minute: "2-digit",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        });

        labels.forEach(el => {
            el.textContent = "آخر تحديث: " + formatted;
        });
    } catch (e) {
        console.error("Update label error", e);
    }
}

