/**
 * Google Apps Script — MCQ Assessment Data Collector
 *
 * SETUP:
 * 1. Create a new Google Sheet (sheets.google.com → Blank spreadsheet)
 * 2. Click Extensions → Apps Script
 * 3. Delete any existing code, paste this entire file
 * 4. Click Deploy → New deployment
 * 5. Type: "Web app"
 * 6. Execute as: "Me"
 * 7. Who has access: "Anyone"
 * 8. Click Deploy, authorize when prompted
 * 9. Copy the Web app URL → paste into config.js
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.type === 'quiz') {
      writeQuizResult(ss, data);
    } else if (data.type === 'feedback') {
      writeFeedback(ss, data);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

function writeQuizResult(ss, data) {
  var sheet = ss.getSheetByName('Quiz Results');
  if (!sheet) {
    sheet = ss.insertSheet('Quiz Results');
    sheet.appendRow([
      'Timestamp', 'Name', 'Department', 'Quiz Mode', 'Score', 'Total',
      'Percentage', 'Status', 'Duration (sec)', 'Answers'
    ]);
    // Bold header
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  // Build answers summary: "Q1:B✓ Q2:A✗(B) Q3:—(C)"
  var answerSummary = '';
  if (data.review) {
    answerSummary = data.review.map(function(r) {
      if (r.status === 'correct') return 'Q' + r.id + ':' + r.given + '✓';
      if (r.status === 'unanswered') return 'Q' + r.id + ':—(' + r.correct + ')';
      return 'Q' + r.id + ':' + r.given + '✗(' + r.correct + ')';
    }).join(' ');
  }

  sheet.appendRow([
    data.timestamp,
    data.name,
    data.dept || '',
    data.mode_name,
    data.score,
    data.total,
    data.percentage + '%',
    data.passed ? 'PASS' : 'FAIL',
    data.duration,
    answerSummary
  ]);
}

function writeFeedback(ss, data) {
  var sheet = ss.getSheetByName('Feedback');
  if (!sheet) {
    sheet = ss.insertSheet('Feedback');
    sheet.appendRow([
      'Timestamp', 'Name',
      'Content & Relevance', 'Trainer Delivery', 'Pace & Structure',
      'Materials', 'Practical', 'Assessment', 'Overall Satisfaction',
      'ES Rating', 'FA Rating', 'EHS Rating',
      'NPS',
      'Most Valuable', 'Least Valuable', 'More Depth', 'Too Much Depth',
      'Improvements', 'Describe to Colleague', 'Logistics',
      'Trainer: Lakshminarasimhan', 'Trainer: Aravind',
      'Future Training Interests', 'NPS Comment'
    ]);
    sheet.getRange(1, 1, 1, 23).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  // Calculate section averages from individual ratings
  // Items 1-5: Content, 6-10: Trainer, 11-14: Pace, 15-17: Materials,
  // 18-21: Practical, 22-24: Assessment, 25-27: Overall
  var sections = [
    [1,2,3,4,5],
    [6,7,8,9,10],
    [11,12,13,14],
    [15,16,17],
    [18,19,20,21],
    [22,23,24],
    [25,26,27]
  ];

  var sectionAvgs = sections.map(function(ids) {
    var vals = ids.map(function(id) { return data.ratings[id] || 0; }).filter(function(v) { return v > 0; });
    return vals.length > 0 ? (vals.reduce(function(a,b) { return a+b; }, 0) / vals.length).toFixed(1) : '';
  });

  var progRatings = data.program_ratings || {};
  var openAnswers = data.open_answers || {};
  var trainerFb = data.trainer_feedback || {};

  sheet.appendRow([
    data.timestamp,
    data.name,
    sectionAvgs[0], sectionAvgs[1], sectionAvgs[2],
    sectionAvgs[3], sectionAvgs[4], sectionAvgs[5], sectionAvgs[6],
    progRatings['es'] || '', progRatings['fa'] || '', progRatings['ehs'] || '',
    data.nps !== null && data.nps !== undefined ? data.nps : '',
    openAnswers['most_valuable'] || '',
    openAnswers['least_valuable'] || '',
    openAnswers['more_depth'] || '',
    openAnswers['too_much_depth'] || '',
    openAnswers['improvements'] || '',
    openAnswers['describe_to_colleague'] || '',
    openAnswers['logistics'] || '',
    trainerFb['lakshminarasimhan'] || '',
    trainerFb['aravind'] || '',
    (data.future_training || []).join(', '),
    data.nps_comment || ''
  ]);
}

// Test function — run manually to verify the script works
function testDoPost() {
  var testQuiz = {
    postData: {
      contents: JSON.stringify({
        type: 'quiz',
        timestamp: new Date().toISOString(),
        name: 'Test User',
        dept: 'Engineering',
        mode_name: 'Day 1 Practice',
        score: 12,
        total: 15,
        percentage: 80,
        passed: true,
        duration: 420,
        review: [
          { id: 1, given: 'B', correct: 'B', status: 'correct' },
          { id: 2, given: 'A', correct: 'C', status: 'incorrect' },
          { id: 3, given: null, correct: 'B', status: 'unanswered' }
        ]
      })
    }
  };
  doPost(testQuiz);
  Logger.log('Test quiz result written');
}
