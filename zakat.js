// zakat.js: منطق حساب الزكاة

// الدوال: getAllData, convertToYER, currentRates, waitForRates
// مُحمّلة مسبقاً من core_logic.js

const totalAssetsEl = document.getElementById('total-assets-yer');
const totalDebtsEl = document.getElementById('total-debts-by-me-yer');
const netAssetsEl = document.getElementById('net-assets-yer');
const nisaabEl = document.getElementById('nisaab-yer');
const zakatDueEl = document.getElementById('zakat-due-yer');
const zakatStatusEl = document.getElementById('zakat-status');

const GOLD_NISAAB_GRAMS = 85; // نصاب الزكاة: 85 جرام من الذهب

async function calculateZakat() {
    await waitForRates();

    // 1. جلب وحساب إجمالي الأصول (بما في ذلك الذهب)
    const assets = await getAllData('assets');
    let totalAssetsYER = 0;
    assets.forEach(asset => {
        totalAssetsYER += convertToYER(asset.value, asset.currency, asset.type);
    });

    // 2. جلب وحساب إجمالي الديون المستحقة عليّ (الخصوم)
    const debts = await getAllData('debts');
    let totalDebtsByMeYER = 0;
    
    debts.forEach(debt => {
        if (debt.type === 'owed_by_me') {
            totalDebtsByMeYER += convertToYER(debt.value, debt.currency);
        }
    });

    // 3. حساب صافي الأصول (المال الذي مر عليه حول)
    const netAssetsForZakat = totalAssetsYER - totalDebtsByMeYER;

    // 4. حساب النصاب
    const nisaabRate = currentRates.GOLD_PER_GRAM_YER;
    const nisaabValue = nisaabRate * GOLD_NISAAB_GRAMS;
    
    // 5. حساب الزكاة المستحقة
    let zakatDue = 0;
    let statusMessage = '';
    
    if (netAssetsForZakat >= nisaabValue) {
        zakatDue = netAssetsForZakat * 0.025; // 2.5%
        statusMessage = '<span style="color: #63c76c; font-weight: bold;">✅ تجب عليك الزكاة. تجاوز رصيدك النصاب.</span>';
    } else {
        zakatDue = 0;
        statusMessage = '<span style="color: #ffaa00; font-weight: bold;">⚠️ لا تجب عليك الزكاة. رصيدك أقل من النصاب.</span>';
    }

    // 6. عرض النتائج
    const formatOptions = { maximumFractionDigits: 0 };
    totalAssetsEl.textContent = totalAssetsYER.toLocaleString(undefined, formatOptions) + ' YER';
    totalDebtsEl.textContent = totalDebtsByMeYER.toLocaleString(undefined, formatOptions) + ' YER';
    netAssetsEl.textContent = netAssetsForZakat.toLocaleString(undefined, formatOptions) + ' YER';
    nisaabEl.textContent = nisaabValue.toLocaleString(undefined, formatOptions) + ' YER';
    zakatDueEl.textContent = zakatDue.toLocaleString(undefined, formatOptions) + ' YER';
    zakatStatusEl.innerHTML = statusMessage;
}

document.addEventListener('DOMContentLoaded', calculateZakat);