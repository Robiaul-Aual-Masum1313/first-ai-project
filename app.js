// State Variables
let apiKey = "";
let quizSubject = "";
let quizDifficulty = "Easy";
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = []; // Array to track user choices
let timerInterval = null;
let timeLeft = 60;
// new comment
// SVG Circumferences
const TIMER_CIRCUMFERENCE = 213.63; // 2 * PI * r (r=34)
const SCORE_CIRCUMFERENCE = 427.26; // 2 * PI * r (r=68)

// DOM Elements
const screens = {
    api: document.getElementById("screen-api"),
    config: document.getElementById("screen-config"),
    loading: document.getElementById("screen-loading"),
    quiz: document.getElementById("screen-quiz"),
    results: document.getElementById("screen-results")
};

// Inputs & Validation
const apiKeyInput = document.getElementById("api-key-input");
const btnToggleApiKey = document.getElementById("btn-toggle-api-key");
const btnValidateApi = document.getElementById("btn-validate-api");
const apiErrorMsg = document.getElementById("api-error-msg");
const subjectInput = document.getElementById("subject-input");
const tagsContainer = document.getElementById("tags-container");
const btnProceed = document.getElementById("btn-proceed");

// Navigation Back Buttons
const btnBackToApi = document.getElementById("btn-back-to-api");

// Loader Screen Info
const loaderTitle = document.getElementById("loader-title");
const loaderSubtitle = document.getElementById("loader-subtitle");

// Quiz HUD & Controls
const currentQNum = document.getElementById("current-q-num");
const timerBar = document.getElementById("timer-bar");
const timerSeconds = document.getElementById("timer-seconds");
const currentScore = document.getElementById("current-score");
const quizProgressBar = document.getElementById("quiz-progress-bar");
const questionText = document.getElementById("question-text");
const optionsGrid = document.getElementById("options-grid");

// Results Controls
const finalScoreVal = document.getElementById("final-score-val");
const scoreRingFill = document.getElementById("score-ring-fill");
const resultsBadge = document.getElementById("results-badge");
const resultsFeedback = document.getElementById("results-feedback");
const resultsSubjectTag = document.getElementById("results-subject-tag");
const reviewList = document.getElementById("review-list");
const btnRestart = document.getElementById("btn-restart");
const btnResetKey = document.getElementById("btn-reset-key");

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    // Check if key is saved in sessionStorage
    const savedKey = sessionStorage.getItem("gemini_quiz_api_key");
    if (savedKey) {
        apiKey = savedKey;
        apiKeyInput.value = savedKey;
        showScreen("config");
    }

    // Toggle API Key Visibility
    btnToggleApiKey.addEventListener("click", () => {
        const type = apiKeyInput.getAttribute("type") === "password" ? "text" : "password";
        apiKeyInput.setAttribute("type", type);
        
        // Toggle eye icon styling or content
        const eyeSvg = btnToggleApiKey.querySelector(".eye-icon");
        if (type === "text") {
            eyeSvg.innerHTML = `
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            `;
        } else {
            eyeSvg.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            `;
        }
    });

    // Validate API Key Button
    btnValidateApi.addEventListener("click", handleApiValidation);

    // Subject Preset Tags
    tagsContainer.addEventListener("click", (e) => {
        if (e.target.classList.contains("tag")) {
            subjectInput.value = e.target.textContent;
            subjectInput.focus();
        }
    });

    // Proceed (Generate Quiz) Button
    btnProceed.addEventListener("click", handleQuizGeneration);

    // Back to API Screen
    btnBackToApi.addEventListener("click", () => {
        showScreen("api");
    });

    // Restart Quiz Flow (to Setup Screen)
    btnRestart.addEventListener("click", () => {
        showScreen("config");
    });

    // Reset API key
    btnResetKey.addEventListener("click", () => {
        sessionStorage.removeItem("gemini_quiz_api_key");
        apiKey = "";
        apiKeyInput.value = "";
        showScreen("api");
    });
});

// Navigation Utility
function showScreen(screenKey) {
    Object.keys(screens).forEach(key => {
        screens[key].classList.remove("active");
    });
    screens[screenKey].classList.add("active");
}

// Check API Key
async function handleApiValidation() {
    const enteredKey = apiKeyInput.value.trim();
    if (!enteredKey) {
        showApiError("API key cannot be empty.");
        shakeElement(apiKeyInput);
        return;
    }

    setLoadingState(btnValidateApi, true, "Checking Key...");
    apiErrorMsg.textContent = "";

    try {
        const isValid = await testApiKey(enteredKey);
        if (isValid) {
            apiKey = enteredKey;
            sessionStorage.setItem("gemini_quiz_api_key", enteredKey);
            showScreen("config");
        } else {
            showApiError("Invalid API key. Please check your credentials.");
            shakeElement(apiKeyInput);
        }
    } catch (err) {
        console.error(err);
        showApiError("Error connecting to Gemini API. Check your internet connection.");
        shakeElement(apiKeyInput);
    } finally {
        setLoadingState(btnValidateApi, false, "Validate & Get Started");
    }
}

// Helper to show API validation errors
function showApiError(msg) {
    apiErrorMsg.textContent = msg;
}

// Add CSS shake animation to element
function shakeElement(el) {
    el.classList.add("shake-animation");
    setTimeout(() => {
        el.classList.remove("shake-animation");
    }, 400);
}

// Test key with basic prompt to avoid consuming quota
async function testApiKey(key) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const payload = {
        contents: [{ parts: [{ text: "Hello" }] }],
        generationConfig: { maxOutputTokens: 5 }
    };

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    return response.ok;
}

// Handle Quiz Generation Trigger
async function handleQuizGeneration() {
    quizSubject = subjectInput.value.trim();
    if (!quizSubject) {
        shakeElement(subjectInput);
        subjectInput.focus();
        return;
    }

    // Get checked difficulty
    const selectedDifficultyInput = document.querySelector('input[name="difficulty"]:checked');
    quizDifficulty = selectedDifficultyInput ? selectedDifficultyInput.value : "Easy";

    // Transition to loading screen
    showScreen("loading");
    updateLoaderText("Consulting Gemini AI", `Formulating 10 high-quality questions about ${quizSubject}...`);

    try {
        const generatedQuestions = await generateQuizFromAI(quizSubject, quizDifficulty);
        if (generatedQuestions && generatedQuestions.length === 10) {
            questions = generatedQuestions;
            startQuiz();
        } else {
            throw new Error("Invalid response content structure or count.");
        }
    } catch (err) {
        console.error(err);
        // Direct back to configuration and alert user
        alert("Failed to generate quiz questions using Gemini API. Please make sure the subject is appropriate and your API Key has correct quotas. Technical Error: " + err.message);
        showScreen("config");
    }
}

// Set button visual state to/from loading
function setLoadingState(btn, isLoading, originalOrLoadingText) {
    if (isLoading) {
        btn.disabled = true;
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = `
            <svg class="loader-ring" style="width:16px; height:16px; animation: loaderSpin 1s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)"></circle>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="white"></path>
            </svg>
            <span>${originalOrLoadingText}</span>
        `;
    } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalHtml || originalOrLoadingText;
    }
}

// Update loader screen text details
function updateLoaderText(title, subtitle) {
    loaderTitle.textContent = title;
    loaderSubtitle.textContent = subtitle;
}

// Send Quiz Generator request to Gemini API
async function generateQuizFromAI(subject, difficulty) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    // Structured instruction prompt
    const prompt = `Generate a quiz with exactly 10 multiple-choice questions about the subject "${subject}" with difficulty level "${difficulty}".
Each question must have exactly 4 options. The correct answer must be one of the option strings exactly.
Provide a concise explanation (1-2 sentences) of why that answer is correct.`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        question: { type: "STRING" },
                        options: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                            description: "Exactly 4 options in a random but logical sequence."
                        },
                        correctAnswer: { 
                            type: "STRING", 
                            description: "Must match one of the items in the options array exactly." 
                        },
                        explanation: { 
                            type: "STRING", 
                            description: "A short text explaining the correct answer." 
                        }
                    },
                    required: ["question", "options", "correctAnswer", "explanation"]
                }
            }
        }
    };

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error?.message || response.statusText;
        throw new Error(`Gemini API returned error: ${message}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
        throw new Error("Empty candidate payload returned from Gemini.");
    }

    const parsedJson = JSON.parse(responseText.trim());
    return parsedJson;
}

// Start Quiz flow
function startQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
    currentScore.textContent = score;
    showScreen("quiz");
    displayQuestion(currentQuestionIndex);
}

// Display specific question
function displayQuestion(index) {
    const question = questions[index];
    
    // Update progress elements
    currentQNum.textContent = index + 1;
    const progressPercent = ((index + 1) / 10) * 100;
    quizProgressBar.style.width = `${progressPercent}%`;

    // Populate question text
    questionText.textContent = question.question;

    // Populate options grid
    optionsGrid.innerHTML = "";
    const letters = ["A", "B", "C", "D"];

    // Render options
    question.options.forEach((option, i) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.innerHTML = `
            <span class="option-letter">${letters[i]}</span>
            <span class="option-content"></span>
            <span class="option-status-icon"></span>
        `;
        
        // Safely set text content for the option payload to prevent HTML injection
        btn.querySelector(".option-content").textContent = option;

        // Click selection handler
        btn.addEventListener("click", () => handleAnswerSelection(option, btn));
        optionsGrid.appendChild(btn);
    });

    // Start timer countdown
    startTimer();
}

// Timer loops
function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 60;
    updateTimerUI();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerUI();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeout();
        }
    }, 1000);
}

// Update timer UI elements (text and SVG countdown stroke)
function updateTimerUI() {
    timerSeconds.textContent = timeLeft;
    
    // Ring countdown offset calculation
    // Max offset = TIMER_CIRCUMFERENCE (fully empty), 0 = (fully full)
    const offset = TIMER_CIRCUMFERENCE * (1 - timeLeft / 60);
    timerBar.style.strokeDashoffset = offset;
}

// Handle option selection click
function handleAnswerSelection(selectedOption, selectedBtn) {
    // Freeze timer instantly
    clearInterval(timerInterval);

    const question = questions[currentQuestionIndex];
    const correctAnswer = question.correctAnswer;
    const isCorrect = (selectedOption.trim() === correctAnswer.trim());

    // Disable all options
    const optionButtons = optionsGrid.querySelectorAll(".option-btn");
    optionButtons.forEach(btn => btn.disabled = true);

    // Apply colors & status icons
    if (isCorrect) {
        score++;
        currentScore.textContent = score;
        selectedBtn.classList.add("correct");
        selectedBtn.querySelector(".option-status-icon").innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;
    } else {
        selectedBtn.classList.add("incorrect");
        selectedBtn.querySelector(".option-status-icon").innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        `;

        // Highlight correct option in green
        highlightCorrectOption();
    }

    // Save answer data
    userAnswers.push({
        questionText: question.question,
        selected: selectedOption,
        correct: correctAnswer,
        wasCorrect: isCorrect,
        explanation: question.explanation
    });

    // Auto-advance after delay
    setTimeout(advanceQuiz, 1500);
}

// Auto-advance if 60 seconds expire
function handleTimeout() {
    // Disable all options
    const optionButtons = optionsGrid.querySelectorAll(".option-btn");
    optionButtons.forEach(btn => btn.disabled = true);

    // Show correct option in green
    highlightCorrectOption();

    const question = questions[currentQuestionIndex];
    
    // Save response as timeout
    userAnswers.push({
        questionText: question.question,
        selected: "No Answer (Timeout)",
        correct: question.correctAnswer,
        wasCorrect: false,
        explanation: question.explanation
    });

    // Advance after delay
    setTimeout(advanceQuiz, 1500);
}

// Find correct option and mark it green
function highlightCorrectOption() {
    const question = questions[currentQuestionIndex];
    const optionButtons = optionsGrid.querySelectorAll(".option-btn");
    
    optionButtons.forEach(btn => {
        const btnText = btn.querySelector(".option-content").textContent.trim();
        if (btnText === question.correctAnswer.trim()) {
            btn.classList.add("correct");
            btn.querySelector(".option-status-icon").innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
        }
    });
}

// Move to next question or end quiz
function advanceQuiz() {
    currentQuestionIndex++;
    if (currentQuestionIndex < 10) {
        displayQuestion(currentQuestionIndex);
    } else {
        showResults();
    }
}

// Render Results Dashboard
function showResults() {
    showScreen("results");
    
    // Set text score info
    finalScoreVal.textContent = score;
    resultsSubjectTag.textContent = `Subject: ${quizSubject} (${quizDifficulty})`;

    // Animate score SVG circle
    // Circumference = SCORE_CIRCUMFERENCE
    // Offset = SCORE_CIRCUMFERENCE * (1 - score / 10)
    // Add small timeout to allow rendering before transition triggers
    setTimeout(() => {
        const offset = SCORE_CIRCUMFERENCE * (1 - score / 10);
        scoreRingFill.style.strokeDashoffset = offset;
    }, 150);

    // Build badge & summary review
    let badgeText = "";
    let feedbackText = "";

    if (score === 10) {
        badgeText = "Gemini Genius";
        feedbackText = "Perfect score! Exceptional knowledge shown. You have fully mastered this subject!";
    } else if (score >= 8) {
        badgeText = "AI Scholar";
        feedbackText = "Excellent work! You have a deep conceptual understanding of the topic.";
    } else if (score >= 6) {
        badgeText = "Knowledge Explorer";
        feedbackText = "Good job! A solid performance. Keep exploring to master the details.";
    } else if (score >= 4) {
        badgeText = "Novice Learner";
        feedbackText = "Decent effort. Review the explanations below, study a bit more, and try again!";
    } else {
        badgeText = "AI Initiate";
        feedbackText = "Keep practicing! Learning is a journey, and every mistake is a step forward.";
    }

    resultsBadge.textContent = badgeText;
    resultsFeedback.textContent = feedbackText;

    // Render Detailed Review list
    reviewList.innerHTML = "";
    userAnswers.forEach((ans, idx) => {
        const reviewItem = document.createElement("div");
        reviewItem.className = "review-item";
        
        const isTimeout = ans.selected === "No Answer (Timeout)";
        const wasCorrect = ans.wasCorrect;

        reviewItem.innerHTML = `
            <div class="review-q-num">Question ${idx + 1}</div>
            <div class="review-question"></div>
            
            <div class="review-answers-compare">
                <div class="compare-row user-answer ${wasCorrect ? 'was-correct' : ''}">
                    <span class="compare-label">Your Answer:</span>
                    <span class="compare-val user-val"></span>
                </div>
                ${!wasCorrect ? `
                <div class="compare-row correct-answer">
                    <span class="compare-label">Correct:</span>
                    <span class="compare-val correct-val"></span>
                </div>
                ` : ''}
            </div>

            <div class="review-explanation">
                <div class="explanation-title">Explanation</div>
                <div class="explanation-text"></div>
            </div>
        `;

        // Safe insertion of string content to prevent XSS
        reviewItem.querySelector(".review-question").textContent = ans.questionText;
        reviewItem.querySelector(".user-val").textContent = ans.selected;
        if (!wasCorrect) {
            reviewItem.querySelector(".correct-val").textContent = ans.correct;
        }
        reviewItem.querySelector(".explanation-text").textContent = ans.explanation || "No explanation provided.";

        reviewList.appendChild(reviewItem);
    });
}
