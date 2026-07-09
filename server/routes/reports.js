const express = require('express');
const reportService = require('../services/reportService');

const router = express.Router();

router.get('/day/:date', (req, res) => {
  const report = reportService.getDailyReport(req.params.date);
  const comparison = reportService.getComparison(req.params.date);
  res.json({ ...report, data_json: { ...report.data_json, comparison } });
});

router.get('/week/:mondayDate', (req, res) => {
  res.json(reportService.getWeeklyReport(req.params.mondayDate));
});

router.get('/month/:monthKey', (req, res) => {
  res.json(reportService.getMonthlyReport(req.params.monthKey));
});

router.get('/year/:yearKey', (req, res) => {
  res.json(reportService.getYearlyReport(req.params.yearKey));
});

// Generic fallback (also serves already-cached month/year reports once those
// generators exist).
router.get('/:period/:periodKey', (req, res) => {
  const db = require('../db');
  const row = db.get('SELECT * FROM reports WHERE period = @period AND period_key = @periodKey', {
    period: req.params.period,
    periodKey: req.params.periodKey,
  });
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json({ ...row, data_json: JSON.parse(row.data_json) });
});

module.exports = router;
