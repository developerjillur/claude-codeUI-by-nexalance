# /goals - Manage Project Goals

View, create, update, and track project goals and objectives.

## Usage

```
/goals                      # List all active goals
/goals add <description>    # Create new goal
/goals update <name> <status|progress>
/goals complete <name>
/goals details <name>
```

## Examples

```
/goals
/goals add Launch MVP by end of Q1
/goals update goal_launch_mvp progress:75
/goals complete goal_authentication
/goals details goal_payment_integration
```

## Commands

### List Goals
```
/goals
```
Shows all goals with their status and progress:
```
📎 Project Goals

Active (3):
  1. goal_launch_mvp [▓▓▓▓▓▓▓░░░] 75%
     "Launch MVP by end of Q1"
     Tasks: 8/12 complete

  2. goal_authentication [▓▓▓▓▓▓▓▓▓▓] 100%
     "Implement user authentication"
     Tasks: 5/5 complete ✓ Ready to mark complete

  3. goal_payment_integration [▓▓░░░░░░░░] 20%
     "Add payment processing"
     Tasks: 2/10 complete
     ⚠️ Blocked: Waiting for Stripe account

Completed (2):
  ✓ goal_setup_project
  ✓ goal_design_system
```

### Add Goal
```
/goals add <description>
```
Creates a new goal:
```
/goals add Implement real-time notifications

✓ Created goal: goal_implement_notifications
  Status: active
  Progress: 0%

  Next step: Link tasks with /goals link
```

### Update Goal
```
/goals update <name> <field>:<value>
```
Update goal properties:
```
/goals update goal_mvp progress:80
/goals update goal_mvp status:blocked
/goals update goal_mvp priority:high
```

Fields:
- `progress`: 0-100
- `status`: active, blocked, paused, completed
- `priority`: low, medium, high, critical
- `deadline`: YYYY-MM-DD

### Complete Goal
```
/goals complete <name>
```
Mark a goal as completed:
```
/goals complete goal_authentication

✓ Goal completed: goal_authentication
  Duration: 5 days
  Tasks completed: 5

  🎉 Congratulations on completing this goal!
```

### Goal Details
```
/goals details <name>
```
Show full goal information:
```
📎 Goal: goal_payment_integration

Description: Add payment processing with Stripe
Status: active
Priority: high
Progress: 20%
Created: 2024-11-28
Deadline: 2024-12-15

Success Criteria:
  ☐ Stripe integration complete
  ☐ Checkout flow working
  ☐ Refund functionality
  ☐ Invoice generation

Linked Tasks:
  ✓ task_stripe_setup
  ✓ task_create_checkout_ui
  ☐ task_implement_webhooks
  ☐ task_refund_logic
  ⚠️ task_invoice_generation (blocked)

Related Decisions:
  - decision:use_stripe_over_paypal
  - decision:subscription_model

Timeline:
  Nov 28: Goal created
  Nov 29: Stripe setup complete
  Nov 30: Checkout UI done
  Dec 01: Webhooks started
  Dec 02: Blocked - Stripe account pending
```

### Link Tasks
```
/goals link <goal_name> <task_name>
```
Connect a task to a goal:
```
/goals link goal_auth task_oauth_setup

✓ Linked task_oauth_setup to goal_auth
  Goal progress updated: 40% → 50%
```

### Unlink Tasks
```
/goals unlink <goal_name> <task_name>
```

## Goal Structure

```json
{
  "name": "goal_launch_mvp",
  "description": "Launch MVP by end of Q1",
  "status": "active",
  "priority": "high",
  "progress": 75,
  "deadline": "2024-03-31",
  "successCriteria": [
    "Core features complete",
    "Testing passed",
    "Deployed to production"
  ],
  "linkedTasks": [
    "task_auth",
    "task_dashboard",
    "task_api"
  ],
  "createdAt": "2024-11-01",
  "updatedAt": "2024-12-02"
}
```

## Progress Calculation

Progress is calculated automatically:
```
progress = (completed_tasks / total_tasks) * 100
```

Manual override available:
```
/goals update goal_name progress:80
```

## Notifications

Goals trigger notifications:
- **At risk**: Progress behind schedule
- **Blocked**: Dependencies not met
- **Ready**: All tasks complete, ready to close
- **Overdue**: Past deadline

## Integration

Goals sync with:
- VS Code Extension Context Manager
- Memory system (`.claude/scratchpad.json`)
- Task tracking

## Tips

1. **Be specific**: Clear, measurable goals
2. **Link tasks**: Connect related work
3. **Update regularly**: Keep progress accurate
4. **Set deadlines**: Track time-sensitive goals
5. **Review weekly**: Use /goals for status check
