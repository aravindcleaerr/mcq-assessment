/* MCQ Assessment — Static Web App Logic */

// ─── State ───────────────────────────────────────────────────────────────────
let state = {
    participant: null,       // { name, dept }
    currentMode: null,       // mode key
    questions: [],           // current quiz questions
    answers: {},             // { questionId: 'A' }
    currentQ: 0,             // 0-indexed
    timerSeconds: 0,
    timerInterval: null,
    quizStartTime: null
};

// ─── Navigation ──────────────────────────────────────────────────────────────
const views = ['home', 'quiz', 'result', 'feedback', 'history'];

function showView(id) {
    views.forEach(v => {
        document.getElementById('view-' + v).classList.add('hidden');
    });
    document.getElementById('view-' + id).classList.remove('hidden');
    window.scrollTo(0, 0);
}

// ─── Home View ───────────────────────────────────────────────────────────────
function initHome() {
    // Load saved name
    const saved = JSON.parse(localStorage.getItem('mcq_participant') || 'null');
    if (saved) {
        document.getElementById('inp-name').value = saved.name || '';
        document.getElementById('inp-dept').value = saved.dept || '';
    }

    // Build mode selector
    const grid = document.getElementById('mode-grid');
    grid.innerHTML = '';

    const practiceLabel = document.createElement('div');
    practiceLabel.className = 'mode-section-title';
    practiceLabel.textContent = 'Daily Practice (15 questions, 15 min)';
    grid.appendChild(practiceLabel);

    const assessLabel = document.createElement('div');
    assessLabel.className = 'mode-section-title';
    assessLabel.textContent = 'Program Assessment (formal)';

    let assessAdded = false;

    Object.keys(QUIZ_MODES).forEach(key => {
        const m = QUIZ_MODES[key];

        if (m.type === 'assessment' && !assessAdded) {
            grid.appendChild(assessLabel);
            assessAdded = true;
        }

        const card = document.createElement('div');
        card.className = 'mode-card';
        card.dataset.mode = key;
        card.innerHTML = `
            <span class="mode-name">${m.name}</span>
            <span class="mode-meta">${m.num_questions}Q &middot; ${m.duration_minutes}min</span>
        `;
        card.addEventListener('click', () => selectMode(key));
        grid.appendChild(card);
    });

    // History count
    const history = JSON.parse(localStorage.getItem('mcq_history') || '[]');
    const histBtn = document.getElementById('btn-history');
    if (history.length > 0) {
        histBtn.classList.remove('hidden');
        histBtn.textContent = `View Past Results (${history.length})`;
    } else {
        histBtn.classList.add('hidden');
    }
}

function selectMode(key) {
    state.currentMode = key;
    document.querySelectorAll('.mode-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.mode === key);
    });
    document.getElementById('btn-start').disabled = false;
}

function startQuiz() {
    const name = document.getElementById('inp-name').value.trim();
    if (!name) {
        alert('Please enter your name.');
        return;
    }
    if (!state.currentMode) {
        alert('Please select a quiz mode.');
        return;
    }

    const dept = document.getElementById('inp-dept').value.trim();
    state.participant = { name, dept };
    localStorage.setItem('mcq_participant', JSON.stringify(state.participant));

    // Load questions
    const mode = QUIZ_MODES[state.currentMode];
    state.questions = [];
    QUIZ_BANK.days.forEach(day => {
        if (mode.days.includes(day.day)) {
            state.questions = state.questions.concat(day.questions);
        }
    });

    state.answers = {};
    state.currentQ = 0;
    state.timerSeconds = mode.duration_minutes * 60;
    state.quizStartTime = Date.now();

    buildQuiz();
    showView('quiz');
    startTimer();
}

// ─── Quiz View ───────────────────────────────────────────────────────────────
function buildQuiz() {
    const mode = QUIZ_MODES[state.currentMode];
    document.getElementById('quiz-mode-name').textContent = mode.name;
    document.getElementById('quiz-mode-meta').textContent =
        `${state.questions.length} questions \u00b7 ${mode.duration_minutes} min`;

    // Build question map dots
    const map = document.getElementById('q-map');
    map.innerHTML = '';
    state.questions.forEach((q, i) => {
        const dot = document.createElement('div');
        dot.className = 'q-dot' + (i === 0 ? ' current' : '');
        dot.textContent = i + 1;
        dot.addEventListener('click', () => goToQuestion(i));
        map.appendChild(dot);
    });

    renderQuestion();
}

function renderQuestion() {
    const q = state.questions[state.currentQ];
    const total = state.questions.length;
    const idx = state.currentQ;

    document.getElementById('q-progress').textContent = `Q ${idx + 1} / ${total}`;
    document.getElementById('q-progress-bar').style.width = ((idx + 1) / total * 100) + '%';

    const container = document.getElementById('q-container');
    container.innerHTML = `
        <div class="question-meta">
            <span class="badge badge-num">Q${idx + 1}</span>
            <span class="badge badge-${q.difficulty}">${q.difficulty}</span>
        </div>
        <div class="question-text">${q.text}</div>
        <div class="options-list">
            ${q.options.map(opt => `
                <button type="button" class="option-btn ${state.answers[q.id] === opt.label ? 'selected' : ''}"
                        onclick="selectAnswer(${q.id}, '${opt.label}', this)">
                    <span class="opt-label">${opt.label})</span> ${opt.text}
                </button>
            `).join('')}
        </div>
    `;

    // Navigation buttons
    document.getElementById('btn-prev').disabled = (idx === 0);
    document.getElementById('btn-next').classList.toggle('hidden', idx === total - 1);
    document.getElementById('btn-submit-quiz').classList.toggle('hidden', idx !== total - 1);

    updateDots();
}

function selectAnswer(qid, label, el) {
    state.answers[qid] = label;
    el.parentElement.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    updateDots();
}

function goToQuestion(idx) {
    if (idx < 0 || idx >= state.questions.length) return;
    state.currentQ = idx;
    renderQuestion();
}

function navQuiz(dir) {
    goToQuestion(state.currentQ + dir);
}

function updateDots() {
    const dots = document.querySelectorAll('#q-map .q-dot');
    dots.forEach((dot, i) => {
        dot.className = 'q-dot';
        if (state.answers[state.questions[i].id]) dot.classList.add('answered');
        if (i === state.currentQ) dot.classList.add('current');
    });
}

// ─── Timer ───────────────────────────────────────────────────────────────────
function startTimer() {
    updateTimerDisplay();
    state.timerInterval = setInterval(() => {
        state.timerSeconds--;
        updateTimerDisplay();
        if (state.timerSeconds <= 0) {
            clearInterval(state.timerInterval);
            submitQuiz(true);
        }
    }, 1000);
}

function updateTimerDisplay() {
    const el = document.getElementById('q-timer');
    const m = Math.floor(Math.max(0, state.timerSeconds) / 60);
    const s = Math.max(0, state.timerSeconds) % 60;
    el.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;

    el.className = 'quiz-timer';
    if (state.timerSeconds <= 60) el.classList.add('danger');
    else if (state.timerSeconds <= 180) el.classList.add('warning');
}

// ─── Submit & Score ──────────────────────────────────────────────────────────
function submitQuiz(autoSubmit) {
    if (!autoSubmit) {
        const unanswered = state.questions.length - Object.keys(state.answers).length;
        if (unanswered > 0) {
            if (!confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) return;
        }
    }

    clearInterval(state.timerInterval);

    const mode = QUIZ_MODES[state.currentMode];
    let correct = 0;
    const review = [];

    state.questions.forEach(q => {
        const given = state.answers[q.id] || null;
        const isCorrect = given === q.correct;
        if (isCorrect) correct++;
        review.push({
            id: q.id,
            text: q.text,
            options: q.options,
            given: given,
            correct: q.correct,
            status: isCorrect ? 'correct' : (given ? 'incorrect' : 'unanswered')
        });
    });

    const total = state.questions.length;
    const pct = Math.round((correct / total) * 100);
    const passed = pct >= mode.pass_percent;

    const result = {
        participant: state.participant,
        mode: state.currentMode,
        modeName: mode.name,
        score: correct,
        total: total,
        percentage: pct,
        passed: passed,
        passPercent: mode.pass_percent,
        review: review,
        timestamp: new Date().toISOString(),
        duration: Math.round((Date.now() - state.quizStartTime) / 1000)
    };

    // Save to state and localStorage history
    state.lastResult = result;
    const history = JSON.parse(localStorage.getItem('mcq_history') || '[]');
    history.unshift(result);
    localStorage.setItem('mcq_history', JSON.stringify(history));

    showResult(result);
}

// ─── Result View ─────────────────────────────────────────────────────────────
function showResult(result) {
    const container = document.getElementById('result-container');

    const durationMin = Math.floor(result.duration / 60);
    const durationSec = result.duration % 60;

    let reviewHtml = result.review.map(r => {
        let ansText = '';
        if (r.status === 'correct') {
            ansText = `Your answer: <strong>${r.given})</strong> &#10004;`;
        } else if (r.status === 'unanswered') {
            const correctOpt = r.options.find(o => o.label === r.correct);
            ansText = `<em>Not answered</em> — Correct: <strong>${r.correct})</strong> ${correctOpt ? correctOpt.text : ''}`;
        } else {
            const correctOpt = r.options.find(o => o.label === r.correct);
            ansText = `Your answer: <strong>${r.given})</strong> &#10008; — Correct: <strong>${r.correct})</strong> ${correctOpt ? correctOpt.text : ''}`;
        }

        return `<div class="review-item ${r.status}">
            <div class="q-num">Q${r.id}</div>
            <div class="q-text">${r.text}</div>
            <div class="q-answer">${ansText}</div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="result-header ${result.passed ? 'passed' : 'failed'}">
            <h2>${result.participant.name}</h2>
            <div class="result-detail">${result.modeName}</div>
            <div class="result-score">${result.percentage}%</div>
            <div class="result-detail">${result.score} / ${result.total} correct &middot; ${durationMin}m ${durationSec}s</div>
            <div class="result-badge ${result.passed ? 'passed' : 'failed'}">
                ${result.passed ? 'PASSED' : 'NOT PASSED'}
            </div>
            <div class="result-detail" style="margin-top:0.5rem;">Pass mark: ${result.passPercent}%</div>
        </div>

        <div class="share-box">
            <button class="btn btn-outline" onclick="shareResult()">Copy Result to Clipboard</button>
            <p style="margin-top:0.5rem; font-size:0.8rem;">Share with your trainer</p>
        </div>

        <div class="card" style="margin-top:1rem;">
            <h2>Answer Review</h2>
            ${reviewHtml}
        </div>

        <div style="text-align:center; margin-top:1rem;">
            <button class="btn btn-accent btn-lg" onclick="showView('feedback')" style="margin-bottom:0.5rem;">
                Complete Course Feedback
            </button><br>
            <button class="btn btn-outline" onclick="backToHome()">Take Another Quiz</button>
        </div>
    `;

    showView('result');
}

function shareResult() {
    const r = state.lastResult;
    const text = `MCQ Assessment Result\n` +
        `Name: ${r.participant.name}\n` +
        `${r.modeName}\n` +
        `Score: ${r.score}/${r.total} (${r.percentage}%)\n` +
        `Status: ${r.passed ? 'PASSED' : 'NOT PASSED'}\n` +
        `Date: ${new Date(r.timestamp).toLocaleString()}\n` +
        `---\nIndustrial Safety Training — Akshaya Createch`;

    if (navigator.share) {
        navigator.share({ title: 'MCQ Result', text: text }).catch(() => {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Result copied to clipboard!');
        });
    } else {
        prompt('Copy your result:', text);
    }
}

// ─── Feedback View ───────────────────────────────────────────────────────────
function initFeedback() {
    const container = document.getElementById('feedback-container');
    const f = FEEDBACK_FORM;

    let html = '';

    // Section A: Ratings
    html += '<div class="card"><h2>Section A: Rating Scale</h2>';
    html += '<p>Rate each aspect from 1 (Poor) to 5 (Excellent)</p>';

    f.sections.forEach(sec => {
        html += `<div class="rating-group"><h3>${sec.title}</h3>`;
        sec.items.forEach(item => {
            html += `<div class="rating-item">
                <span class="rating-label">${item.text}</span>
                <div class="rating-stars">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="star-btn" data-rating="${item.id}" data-value="${v}"
                        onclick="setRating(${item.id}, ${v}, this)">${v}</button>`).join('')}
                </div>
            </div>`;
        });
        html += '</div>';
    });
    html += '</div>';

    // Program ratings
    html += '<div class="card"><h2>Rate Each Program</h2>';
    f.program_ratings.forEach(prog => {
        html += `<div class="rating-item">
            <span class="rating-label"><strong>${prog.name}</strong></span>
            <div class="rating-stars">
                ${[1,2,3,4,5].map(v => `<button type="button" class="star-btn" data-rating="prog_${prog.id}" data-value="${v}"
                    onclick="setRating('prog_${prog.id}', ${v}, this)">${v}</button>`).join('')}
            </div>
        </div>`;
    });
    html += '</div>';

    // Open questions
    html += '<div class="card"><h2>Section B: Your Thoughts</h2>';
    f.open_questions.forEach(oq => {
        html += `<div class="form-group">
            <label>${oq.text}</label>
            <textarea id="fb-open-${oq.id}" rows="3" placeholder="Your response..."></textarea>
        </div>`;
    });
    html += '</div>';

    // NPS
    html += `<div class="card"><h2>Recommendation</h2>
        <p>How likely are you to recommend this training to a colleague?</p>
        <div class="nps-scale">
            ${Array.from({length:11}, (_,i) => `<button type="button" class="nps-btn" onclick="setNps(${i}, this)">${i}</button>`).join('')}
        </div>
        <div class="nps-labels"><span>Not at all likely</span><span>Extremely likely</span></div>
        <div class="form-group" style="margin-top:1rem;">
            <label>If you scored 8 or below, what would need to change?</label>
            <textarea id="fb-nps-comment" rows="2" placeholder="Optional..."></textarea>
        </div>
    </div>`;

    // Future training
    html += '<div class="card"><h2>Future Training Interests</h2>';
    html += '<p>Select all that interest you:</p><ul class="checkbox-list">';
    f.future_training_options.forEach(opt => {
        html += `<li><label><input type="checkbox" value="${opt}"> ${opt}</label></li>`;
    });
    html += `<li><label><input type="checkbox" value="other"> Other:</label>
        <input type="text" id="fb-future-other" placeholder="Specify..." style="width:200px;padding:0.3rem 0.5rem;border:1px solid var(--border);border-radius:4px;margin-left:0.3rem;"></li>`;
    html += '</ul></div>';

    // Trainer feedback
    html += '<div class="card"><h2>Trainer Feedback (Optional)</h2>';
    f.trainers.forEach(t => {
        html += `<div class="form-group">
            <label>${t.name}</label>
            <textarea id="fb-trainer-${t.id}" rows="2" placeholder="Your feedback..."></textarea>
        </div>`;
    });
    html += '</div>';

    // Submit
    html += '<button class="btn btn-accent btn-block btn-lg" onclick="submitFeedback()">Submit Feedback</button>';
    html += '<p style="text-align:center;margin-top:0.8rem;color:var(--text-light);font-size:0.8rem;">Your feedback is confidential.</p>';

    container.innerHTML = html;
}

// Feedback helpers
let feedbackRatings = {};
let feedbackNps = null;

function setRating(itemId, val, el) {
    feedbackRatings[itemId] = val;
    el.parentElement.querySelectorAll('.star-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.value) <= val);
    });
}

function setNps(val, el) {
    feedbackNps = val;
    document.querySelectorAll('.nps-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.textContent) === val);
    });
}

function submitFeedback() {
    const f = FEEDBACK_FORM;
    const fb = {
        participant: state.participant,
        ratings: feedbackRatings,
        nps: feedbackNps,
        nps_comment: document.getElementById('fb-nps-comment')?.value || '',
        open_answers: {},
        trainer_feedback: {},
        future_training: [],
        timestamp: new Date().toISOString()
    };

    f.open_questions.forEach(oq => {
        const val = document.getElementById('fb-open-' + oq.id)?.value?.trim();
        if (val) fb.open_answers[oq.id] = val;
    });

    f.trainers.forEach(t => {
        const val = document.getElementById('fb-trainer-' + t.id)?.value?.trim();
        if (val) fb.trainer_feedback[t.id] = val;
    });

    document.querySelectorAll('.checkbox-list input:checked').forEach(cb => {
        if (cb.value === 'other') {
            const other = document.getElementById('fb-future-other')?.value?.trim();
            if (other) fb.future_training.push('Other: ' + other);
        } else {
            fb.future_training.push(cb.value);
        }
    });

    // Save to localStorage
    const fbHistory = JSON.parse(localStorage.getItem('mcq_feedback') || '[]');
    fbHistory.push(fb);
    localStorage.setItem('mcq_feedback', JSON.stringify(fbHistory));

    // Show thank you
    document.getElementById('feedback-container').innerHTML = `
        <div style="text-align:center; padding:3rem 1rem;">
            <div style="font-size:3rem;">&#10004;&#65039;</div>
            <h2 style="color:var(--primary); margin:1rem 0 0.5rem;">Thank you for your feedback!</h2>
            <p style="color:var(--text-light);">Your responses have been recorded.</p>
            <button class="btn btn-outline" onclick="backToHome()" style="margin-top:2rem;">Back to Home</button>
        </div>
    `;
}

// ─── History View ────────────────────────────────────────────────────────────
function showHistory() {
    const history = JSON.parse(localStorage.getItem('mcq_history') || '[]');
    const container = document.getElementById('history-container');

    if (history.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-light); padding:2rem;">No quiz history yet.</p>';
    } else {
        container.innerHTML = history.map((r, i) => `
            <div class="history-item">
                <div>
                    <div class="history-name">${r.modeName}</div>
                    <div class="history-meta">${new Date(r.timestamp).toLocaleString()}</div>
                </div>
                <div class="history-score ${r.passed ? 'pass' : 'fail'}">
                    ${r.percentage}% ${r.passed ? '&#10004;' : '&#10008;'}
                </div>
            </div>
        `).join('');

        container.innerHTML += `
            <div style="text-align:center; margin-top:1rem;">
                <button class="btn btn-outline" onclick="if(confirm('Clear all history?')){localStorage.removeItem('mcq_history');showHistory();}">Clear History</button>
            </div>`;
    }

    showView('history');
}

// ─── Utilities ───────────────────────────────────────────────────────────────
function backToHome() {
    clearInterval(state.timerInterval);
    state.currentMode = null;
    state.questions = [];
    state.answers = {};
    initHome();
    initFeedback();
    feedbackRatings = {};
    feedbackNps = null;
    showView('home');
}

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initHome();
    initFeedback();
    showView('home');
});
