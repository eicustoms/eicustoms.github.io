document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const selections = {
        case: params.get('case') || localStorage.getItem('quote_case') || '',
        bezel: params.get('bezel') || localStorage.getItem('quote_bezel') || '',
        dial: params.get('dial') || localStorage.getItem('quote_dial') || '',
        strap: params.get('strap') || localStorage.getItem('quote_strap') || ''
    };

    const hasCustomizerSelection = Object.values(selections).some(value => value);
    const quoteDetails = document.querySelector('.quote-details');
    const submitFeedback = document.getElementById('submit-feedback');
    const form = document.querySelector('.contact-form');

    const summaryText = {
        case: { steel: 'Oystersteel', gold: 'Yellow Gold' },
        bezel: { smooth: 'Smooth', fluted: 'Fluted' },
        dial: { white: 'White', black: 'Black' },
        strap: { leather: 'Leather', metal: 'Jubilee' }
    };

    const summaryTextValue = hasCustomizerSelection
        ? `Case: ${summaryText.case[selections.case] || 'N/A'}, Bezel: ${summaryText.bezel[selections.bezel] || 'N/A'}, Dial: ${summaryText.dial[selections.dial] || 'N/A'}, Strap: ${summaryText.strap[selections.strap] || 'N/A'}`
        : '';

    const inputs = {
        case: document.getElementById('input-case'),
        bezel: document.getElementById('input-bezel'),
        dial: document.getElementById('input-dial'),
        strap: document.getElementById('input-strap'),
        summary: document.getElementById('input-quote-summary')
    };

    if (hasCustomizerSelection) {
        if (quoteDetails) quoteDetails.classList.remove('hidden');
        if (inputs.case) inputs.case.value = selections.case;
        if (inputs.bezel) inputs.bezel.value = selections.bezel;
        if (inputs.dial) inputs.dial.value = selections.dial;
        if (inputs.strap) inputs.strap.value = selections.strap;
        if (inputs.summary) inputs.summary.value = summaryTextValue;
        document.getElementById('quote-summary').textContent = summaryTextValue;
    } else {
        if (quoteDetails) quoteDetails.classList.add('hidden');
    }

    const showThankYou = () => {
        if (form) form.style.display = 'none';
        document.getElementById('thank-you-message').classList.add('is-visible');
    };

    const showError = message => {
        if (submitFeedback) {
            submitFeedback.textContent = message;
            submitFeedback.style.color = '#b00020';
        }
    };

    if (form) {
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (submitFeedback) {
                submitFeedback.textContent = '';
            }

            const data = {
                name: form.name.value,
                email: form.email.value,
                phone: form.phone.value,
                message: form.message.value,
                custom_case: selections.case,
                custom_bezel: selections.bezel,
                custom_dial: selections.dial,
                custom_strap: selections.strap,
                custom_summary: summaryTextValue
            };

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    throw new Error('There was a problem submitting your request.');
                }

                const result = await response.json();
                if (result.status === 'ok') {
                    showThankYou();
                } else {
                    showError('Unable to submit right now. Please try again later.');
                }
            } catch (error) {
                showError(error.message || 'Unable to submit right now. Please try again later.');
            }
        });
    }
});
