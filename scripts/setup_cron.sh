#!/bin/bash
# TaxCore Auto Export Cron Setup
# Runs daily at 10:00 PM (22:00)

echo "Setting up automated daily backup..."

# Create cron job
CRON_JOB="0 22 * * * cd /app && /usr/bin/python3 /app/scripts/auto_export.py >> /var/log/taxcore_export.log 2>&1"

# Add to crontab
(crontab -l 2>/dev/null | grep -v "auto_export.py"; echo "$CRON_JOB") | crontab -

echo "✅ Automated backup installed successfully!"
echo ""
echo "┌─────────────────────────────────────────┐"
echo "│   AUTOMATED DAILY BACKUP CONFIGURED     │"
echo "├─────────────────────────────────────────┤"
echo "│ Schedule:  Daily at 10:00 PM (22:00)   │"
echo "│ Format:    Excel (.xlsx)                │"
echo "│ Location:  /app/exports/                │"
echo "│ Retention: 30 days                      │"
echo "│ Status:    ✅ ACTIVE                     │"
echo "└─────────────────────────────────────────┘"
echo ""
echo "Current crontab:"
crontab -l
