/**
 * OpenTradex 24/7 AI Agent Background Service
 * Runs continuously to monitor markets, execute trading strategies,
 * and maintain the AI harness loop.
 */

import { EventEmitter } from 'events';
import { MarketScanner, ScanResult } from './scanner.js';
import { RiskManager } from './risk.js';
import { TradeExecutor } from './executor.js';
import { Logger } from './logger.js';

export interface AgentConfig {
  mode: 'paper-only' | 'paper-default' | 'live-allowed';
  scanInterval: number; // milliseconds between market scans
  autoLoop: boolean;
  maxCycles: number; // 0 = unlimited
  riskLimits: {
    maxPositionSize: number;
    maxDailyLoss: number;
    maxDrawdown: number;
  };
}

export interface AgentStatus {
  running: boolean;
  mode: string;
  cycles: number;
  lastScan: Date | null;
  openPositions: number;
  dayPnL: number;
  errors: number;
}

const DEFAULT_CONFIG: AgentConfig = {
  mode: 'paper-only',
  scanInterval: 60000, // 1 minute
  autoLoop: false,
  maxCycles: 0,
  riskLimits: {
    maxPositionSize: 1000,
    maxDailyLoss: 500,
    maxDrawdown: 0.1, // 10%
  },
};

export class AIAgent extends EventEmitter {
  private config: AgentConfig;
  private status: AgentStatus;
  private scanner: MarketScanner;
  private riskManager: RiskManager;
  private executor: TradeExecutor;
  private logger: Logger;
  private loopTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: Partial<AgentConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.status = {
      running: false,
      mode: this.config.mode,
      cycles: 0,
      lastScan: null,
      openPositions: 0,
      dayPnL: 0,
      errors: 0,
    };

    this.scanner = new MarketScanner();
    this.riskManager = new RiskManager(this.config.riskLimits);
    this.executor = new TradeExecutor(this.config.mode);
    this.logger = new Logger('AIAgent');

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.scanner.on('opportunity', (result: ScanResult) => {
      this.handleOpportunity(result);
    });

    this.scanner.on('error', (error: Error) => {
      this.status.errors++;
      this.logger.error('Scanner error:', error);
      this.emit('error', error);
    });

    this.executor.on('trade', (trade: any) => {
      this.logger.info('Trade executed:', trade);
      this.emit('trade', trade);
    });

    this.riskManager.on('limit-breach', (breach: any) => {
      this.logger.warn('Risk limit breached:', breach);
      this.emit('risk-alert', breach);
      if (breach.severity === 'critical') {
        this.emergencyStop();
      }
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Agent already running');
      return;
    }

    this.logger.info('Starting AI Agent...', { config: this.config });
    this.isRunning = true;
    this.status.running = true;
    this.emit('started');

    // Initial scan
    await this.runCycle();

    // Start auto-loop if enabled
    if (this.config.autoLoop) {
      this.startAutoLoop();
    }
  }

  stop(): void {
    this.logger.info('Stopping AI Agent...');
    this.isRunning = false;
    this.status.running = false;

    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }

    this.emit('stopped');
  }

  async emergencyStop(): Promise<void> {
    this.logger.warn('EMERGENCY STOP triggered');
    this.stop();

    // Close all positions
    await this.executor.closeAllPositions();

    this.emit('emergency-stop');
  }

  private startAutoLoop(): void {
    this.logger.info(`Starting auto-loop with ${this.config.scanInterval}ms interval`);

    this.loopTimer = setInterval(async () => {
      if (!this.isRunning) return;

      // Check cycle limit
      if (this.config.maxCycles > 0 && this.status.cycles >= this.config.maxCycles) {
        this.logger.info('Max cycles reached, stopping auto-loop');
        this.stop();
        return;
      }

      await this.runCycle();
    }, this.config.scanInterval);
  }

  private async runCycle(): Promise<void> {
    if (!this.isRunning) return;

    this.status.cycles++;
    this.status.lastScan = new Date();

    this.logger.info(`Starting cycle #${this.status.cycles}`);
    this.emit('cycle-start', this.status.cycles);

    try {
      // 1. Scan markets
      const opportunities = await this.scanner.scan();
      this.logger.debug(`Found ${opportunities.length} opportunities`);

      // 2. Filter through risk manager
      const approved = opportunities.filter((opp) =>
        this.riskManager.evaluate(opp)
      );
      this.logger.debug(`${approved.length} opportunities passed risk check`);

      // 3. Execute approved trades
      for (const opportunity of approved) {
        if (!this.isRunning) break;

        const result = await this.executor.execute(opportunity);
        if (result.success) {
          this.status.dayPnL += result.pnl || 0;
        }
      }

      // 4. Update positions
      this.status.openPositions = await this.executor.getOpenPositionCount();

      this.journal.push({
        cycle: this.status.cycles,
        ts: new Date(),
        opportunities: opportunities.length,
        executed: approved.length,
      });
      if (this.journal.length > 500) this.journal.splice(0, this.journal.length - 500);

      this.emit('cycle-complete', {
        cycle: this.status.cycles,
        opportunities: opportunities.length,
        executed: approved.length,
        status: this.status,
      });
    } catch (error) {
      this.status.errors++;
      this.logger.error('Cycle error:', error);
      this.emit('error', error);
    }
  }

  private async handleOpportunity(result: ScanResult): Promise<void> {
    if (!this.isRunning) return;

    // Real-time opportunity handling (outside of regular cycle)
    if (result.urgency === 'high') {
      const approved = this.riskManager.evaluate(result);
      if (approved) {
        await this.executor.execute(result);
      }
    }
  }

  // Public API

  getStatus(): AgentStatus {
    return { ...this.status };
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  getScanner(): MarketScanner {
    return this.scanner;
  }

  getJournal(): Array<{ cycle: number; ts: Date; opportunities: number; executed: number }> {
    return [...this.journal];
  }

  private journal: Array<{ cycle: number; ts: Date; opportunities: number; executed: number }> = [];

  updateConfig(updates: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...updates };
    this.status.mode = this.config.mode;
    this.executor.setMode(this.config.mode);
    this.riskManager.updateLimits(this.config.riskLimits);
    this.emit('config-updated', this.config);
  }

  setAutoLoop(enabled: boolean): void {
    this.config.autoLoop = enabled;

    if (enabled && this.isRunning && !this.loopTimer) {
      this.startAutoLoop();
    } else if (!enabled && this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }

  async triggerScan(): Promise<ScanResult[]> {
    return this.scanner.scan();
  }

  async manualTrade(params: {
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    type?: 'market' | 'limit';
    price?: number;
  }): Promise<any> {
    // Check risk first
    const riskCheck = this.riskManager.checkTrade(params);
    if (!riskCheck.approved) {
      throw new Error(`Trade rejected: ${riskCheck.reason}`);
    }

    return this.executor.executeDirect(params);
  }
}

// Export singleton factory
let agentInstance: AIAgent | null = null;

export function getAgent(config?: Partial<AgentConfig>): AIAgent {
  if (!agentInstance) {
    agentInstance = new AIAgent(config);
  }
  return agentInstance;
}

export function resetAgent(): void {
  if (agentInstance) {
    agentInstance.stop();
    agentInstance = null;
  }
}
