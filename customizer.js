// Watch customizer controls and quote transfer logic
const CUSTOMIZER_SUMMARY = {
    case: { steel: 'Oystersteel', gold: 'Yellow Gold' },
    bezel: { smooth: 'Smooth', fluted: 'Fluted' },
    dial: { white: 'White', black: 'Black' },
    strap: { leather: 'Leather', metal: 'Jubilee' }
};

document.addEventListener('DOMContentLoaded', () => {
    const watchCase = document.querySelector('.watch-case');
    const watchDial = document.querySelector('.watch-dial');
    const watchStrapTop = document.querySelector('.watch-strap.top');
    const watchStrapBottom = document.querySelector('.watch-strap.bottom');
    const summaryCase = document.getElementById('summary-case');
    const summaryBezel = document.getElementById('summary-bezel');
    const summaryDial = document.getElementById('summary-dial');
    const summaryStrap = document.getElementById('summary-strap');
    const quoteLink = document.getElementById('quote-link');

    const selectors = {
        case: document.querySelector('input[name="case"]:checked')?.value || 'steel',
        bezel: document.querySelector('input[name="bezel"]:checked')?.value || 'smooth',
        dial: document.querySelector('input[name="dial"]:checked')?.value || 'white',
        strap: document.querySelector('input[name="strap"]:checked')?.value || 'leather'
    };

    const updateQuoteLink = () => {
        const params = new URLSearchParams(selectors);
        quoteLink.href = `contact.html?${params.toString()}`;
    };

    const updateSummary = () => {
        summaryCase.textContent = CUSTOMIZER_SUMMARY.case[selectors.case];
        summaryBezel.textContent = CUSTOMIZER_SUMMARY.bezel[selectors.bezel];
        summaryDial.textContent = CUSTOMIZER_SUMMARY.dial[selectors.dial];
        summaryStrap.textContent = CUSTOMIZER_SUMMARY.strap[selectors.strap];
    };

    const updateDisplay = () => {
        watchCase.className = `watch-case ${selectors.case}`;
        watchDial.className = `watch-dial ${selectors.dial}`;
        watchStrapTop.className = `watch-strap top ${selectors.strap}`;
        watchStrapBottom.className = `watch-strap bottom ${selectors.strap}`;
        updateQuoteLink();
        updateSummary();

        // Persist selections so contact page can fall back if needed
        localStorage.setItem('quote_case', selectors.case);
        localStorage.setItem('quote_bezel', selectors.bezel);
        localStorage.setItem('quote_dial', selectors.dial);
        localStorage.setItem('quote_strap', selectors.strap);
    };

    const updateOption = (partName, value) => {
        selectors[partName] = value;
        updateDisplay();
    };

    document.querySelectorAll('input[name="case"]').forEach(input => {
        input.addEventListener('change', () => updateOption('case', input.value));
    });
    document.querySelectorAll('input[name="bezel"]').forEach(input => {
        input.addEventListener('change', () => updateOption('bezel', input.value));
    });
    document.querySelectorAll('input[name="dial"]').forEach(input => {
        input.addEventListener('change', () => updateOption('dial', input.value));
    });
    document.querySelectorAll('input[name="strap"]').forEach(input => {
        input.addEventListener('change', () => updateOption('strap', input.value));
    });

    updateDisplay();
});
