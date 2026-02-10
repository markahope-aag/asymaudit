import cron from 'node-cron';
import { supabase } from '../config/supabase';
import { addAuditJob } from '../queue/setup';
import { logger } from '../utils/logger';

const activeCrons: Map<string, cron.ScheduledTask> = new Map();

export async function initScheduler(): Promise<void> {
  logger.info('Initializing audit scheduler');

  try {
    // Load all active schedules from Supabase
    const { data: schedules, error } = await supabase
      .from('audit_schedules')
      .select('*')
      .eq('is_active', true);

    if (error) {
      logger.warn({ error: error.message }, 'Could not load schedules from Supabase (table may not exist yet), skipping scheduler');
      return;
    }

    if (!schedules || schedules.length === 0) {
      logger.info('No active schedules found');
      return;
    }

    // Register each schedule
    for (const schedule of schedules) {
      try {
        await registerSchedule(schedule);
      } catch (error) {
        logger.error({ 
          error, 
          scheduleId: schedule.id,
          auditType: schedule.audit_type 
        }, 'Failed to register schedule');
      }
    }

    // Set up periodic refresh of schedules (every 5 minutes)
    cron.schedule('*/5 * * * *', async () => {
      try {
        await refreshSchedules();
      } catch (error) {
        logger.error({ error }, 'Failed to refresh schedules');
      }
    });

    logger.info({ 
      schedulesLoaded: schedules.length,
      activeSchedules: activeCrons.size 
    }, 'Audit scheduler initialized');

  } catch (error) {
    logger.error({ error }, 'Failed to initialize scheduler');
    throw error;
  }
}

async function registerSchedule(schedule: any): Promise<void> {
  const scheduleLogger = logger.child({
    scheduleId: schedule.id,
    clientId: schedule.client_id,
    auditType: schedule.audit_type,
  });

  try {
    // Stop existing cron if it exists
    if (activeCrons.has(schedule.id)) {
      activeCrons.get(schedule.id)?.stop();
      activeCrons.delete(schedule.id);
    }

    // Validate cron expression
    if (!cron.validate(schedule.cron_expression)) {
      throw new Error(`Invalid cron expression: ${schedule.cron_expression}`);
    }

    // Create new cron task
    const task = cron.schedule(schedule.cron_expression, async () => {
      scheduleLogger.info('Cron triggered, creating audit run');

      try {
        // Create a new audit run
        const { data: run, error: runError } = await supabase
          .from('audit_runs')
          .insert({
            client_id: schedule.client_id,
            audit_type: schedule.audit_type,
            status: 'pending',
            metadata: {
              triggered_by: 'scheduler',
              schedule_id: schedule.id,
            },
          })
          .select()
          .single();

        if (runError || !run) {
          throw new Error(`Failed to create audit run: ${runError?.message}`);
        }

        // Add job to queue
        await addAuditJob(
          schedule.client_id,
          schedule.audit_type,
          run.id,
          {
            priority: 5, // Normal priority for scheduled jobs
            metadata: {
              scheduled: true,
              schedule_id: schedule.id,
            },
          }
        );

        // Update last_run_at timestamp
        const { error: updateError } = await supabase
          .from('audit_schedules')
          .update({ 
            last_run_at: new Date().toISOString() 
          })
          .eq('id', schedule.id);

        if (updateError) {
          scheduleLogger.error({ error: updateError }, 'Failed to update last_run_at');
        }

        scheduleLogger.info({ runId: run.id }, 'Scheduled audit job created successfully');

      } catch (error) {
        scheduleLogger.error({ error }, 'Failed to execute scheduled audit');
      }
    }, {
      scheduled: false, // Don't start immediately
      timezone: 'UTC',  // Use UTC for consistency
    });

    // Start the task
    task.start();
    activeCrons.set(schedule.id, task);

    scheduleLogger.debug({ 
      cronExpression: schedule.cron_expression 
    }, 'Schedule registered successfully');

  } catch (error) {
    scheduleLogger.error({ error }, 'Failed to register schedule');
    throw error;
  }
}

async function refreshSchedules(): Promise<void> {
  logger.debug('Refreshing audit schedules');

  try {
    // Fetch current active schedules
    const { data: schedules, error } = await supabase
      .from('audit_schedules')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to fetch schedules: ${error.message}`);
    }

    const currentScheduleIds = new Set((schedules || []).map(s => s.id));
    const activeScheduleIds = new Set(activeCrons.keys());

    // Stop and remove schedules that are no longer active
    for (const scheduleId of activeScheduleIds) {
      if (!currentScheduleIds.has(scheduleId)) {
        const task = activeCrons.get(scheduleId);
        if (task) {
          task.stop();
          activeCrons.delete(scheduleId);
          logger.info({ scheduleId }, 'Removed inactive schedule');
        }
      }
    }

    // Register new or updated schedules
    for (const schedule of schedules || []) {
      try {
        // Always re-register to pick up any changes
        await registerSchedule(schedule);
      } catch (error) {
        logger.error({ 
          error, 
          scheduleId: schedule.id 
        }, 'Failed to register schedule during refresh');
      }
    }

    logger.debug({ 
      totalSchedules: schedules?.length || 0,
      activeSchedules: activeCrons.size 
    }, 'Schedule refresh completed');

  } catch (error) {
    logger.error({ error }, 'Failed to refresh schedules');
  }
}

export async function stopScheduler(): Promise<void> {
  logger.info('Stopping audit scheduler');

  // Stop all active cron tasks
  for (const [scheduleId, task] of activeCrons) {
    try {
      task.stop();
      logger.debug({ scheduleId }, 'Stopped schedule');
    } catch (error) {
      logger.error({ error, scheduleId }, 'Failed to stop schedule');
    }
  }

  activeCrons.clear();
  logger.info('Audit scheduler stopped');
}

export function getActiveSchedules(): Array<{
  scheduleId: string;
  isRunning: boolean;
}> {
  return Array.from(activeCrons.entries()).map(([scheduleId, task]) => ({
    scheduleId,
    isRunning: true, // Assume running if in the map
  }));
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await stopScheduler();
});

process.on('SIGINT', async () => {
  await stopScheduler();
});