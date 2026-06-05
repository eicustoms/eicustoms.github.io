document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const selections = Object.fromEntries(params.entries());

    const knownFields = ['case', 'bezel', 'dial', 'strap', 'movement', 'dialColor', 'caseColor', 'bandColor', 'claspColor', 'dialImage'];
    knownFields.forEach(field => {
        if (!selections[field]) {
            const stored = localStorage.getItem(`quote_${field}`);
            if (stored) selections[field] = stored;
        }
    });

    const hasCustomizerSelection = knownFields.some(field => Boolean(selections[field]));
    const quoteDetails = document.querySelector('.quote-details');
    const submitFeedback = document.getElementById('submit-feedback');
    const form = document.querySelector('.contact-form');

    const summaryLabels = {
        case: { steel: 'Oystersteel', gold: 'Yellow Gold' },
        bezel: { smooth: 'Smooth', fluted: 'Fluted' },
        dial: { white: 'White', black: 'Black' },
        strap: { leather: 'Leather', metal: 'Jubilee' }
    };

    const selectionSummary = field => {
        if (!selections[field]) return null;
        if (field === 'dialImage') return 'Custom dial image uploaded';
        if (summaryLabels[field]?.[selections[field]]) return summaryLabels[field][selections[field]];
        return selections[field];
    };

    const summaryTextValue = hasCustomizerSelection
        ? Object.entries(selections)
            .filter(([key, value]) => value && knownFields.includes(key))
            .map(([key, value]) => {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                return `${label}: ${selectionSummary(key) || value}`;
            })
            .join(', ')
        : '';

    const inputs = {
        case: document.getElementById('input-case'),
        bezel: document.getElementById('input-bezel'),
        dial: document.getElementById('input-dial'),
        strap: document.getElementById('input-strap'),
        movement: document.getElementById('input-movement'),
        dialColor: document.getElementById('input-dial-color'),
        caseColor: document.getElementById('input-case-color'),
        bandColor: document.getElementById('input-band-color'),
        claspColor: document.getElementById('input-clasp-color'),
        dialImage: document.getElementById('input-dial-image'),
        summary: document.getElementById('input-quote-summary')
    };

    if (hasCustomizerSelection) {
        if (quoteDetails) quoteDetails.classList.remove('hidden');
        if (inputs.case) inputs.case.value = selections.case || '';
        if (inputs.bezel) inputs.bezel.value = selections.bezel || '';
        if (inputs.dial) inputs.dial.value = selections.dial || '';
        if (inputs.strap) inputs.strap.value = selections.strap || '';
        if (inputs.movement) inputs.movement.value = selections.movement || '';
        if (inputs.dialColor) inputs.dialColor.value = selections.dialColor || '';
        if (inputs.caseColor) inputs.caseColor.value = selections.caseColor || '';
        if (inputs.bandColor) inputs.bandColor.value = selections.bandColor || '';
        if (inputs.claspColor) inputs.claspColor.value = selections.claspColor || '';
        if (inputs.dialImage) inputs.dialImage.value = selections.dialImage || '';
        if (inputs.summary) inputs.summary.value = summaryTextValue;
        const summaryElement = document.getElementById('quote-summary');
        const imageContainer = document.getElementById('quote-image-container');
        if (summaryElement) summaryElement.textContent = summaryTextValue;
        if (imageContainer) {
            imageContainer.innerHTML = '';
            if (selections.dialImage) {
                const img = document.createElement('img');
                img.src = selections.dialImage;
                img.alt = 'Custom dial image preview';
                imageContainer.appendChild(img);
            }
        }
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
                custom_case: selections.case || '',
                custom_bezel: selections.bezel || '',
                custom_dial: selections.dial || '',
                custom_strap: selections.strap || '',
                custom_movement: selections.movement || '',
                custom_dialColor: selections.dialColor || '',
                custom_caseColor: selections.caseColor || '',
                custom_bandColor: selections.bandColor || '',
                custom_claspColor: selections.claspColor || '',
                custom_dialImage: selections.dialImage || '',
                custom_summary: summaryTextValue,
                custom_fields: selections
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
