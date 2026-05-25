export type QualitySignal = {
    severity: 'info' | 'warning' | 'critical';
    category: 'ats_keywords' | 'voice' | 'achievement_match' | 'quality_gate' | 'blueprint' | 'bridged_gap';
    message: string;
    evidence?: string[];
};

export interface SignalInputs {
    qualityGateOutcome?: { passed: boolean; flags: string[] } | null;
    blueprintFallback: boolean;
    atsCoverage?: { coverage: number; missingFromOutput: string[]; criticalMissing: string[] } | null;
    achievementMatch?: { topScore: number; matchCount: number } | null;
    voiceScrubberFired?: { count: number; categories: string[] } | null;
}

export function collectSignals(inputs: SignalInputs): QualitySignal[] {
    const signals: QualitySignal[] = [];

    if (inputs.blueprintFallback) {
        signals.push({
            severity: 'warning',
            category: 'blueprint',
            message: 'Strategic blueprint failed — used generic prompt instead. Quality may be lower than usual.',
        });
    }

    if (inputs.qualityGateOutcome === null) {
        signals.push({
            severity: 'warning',
            category: 'quality_gate',
            message: 'Quality review pass was skipped.',
        });
    } else if (inputs.qualityGateOutcome && !inputs.qualityGateOutcome.passed) {
        signals.push({
            severity: 'warning',
            category: 'quality_gate',
            message: 'Quality review flagged issues — review the document before sending.',
            evidence: inputs.qualityGateOutcome.flags,
        });
    }

    if (inputs.atsCoverage && inputs.atsCoverage.coverage < 0.5) {
        signals.push({
            severity: 'critical',
            category: 'ats_keywords',
            message: `ATS keyword coverage low (${Math.round(inputs.atsCoverage.coverage * 100)}%). Resume may be filtered before reaching a human reader.`,
            evidence: inputs.atsCoverage.criticalMissing.length > 0
                ? inputs.atsCoverage.criticalMissing
                : inputs.atsCoverage.missingFromOutput.slice(0, 5),
        });
    }

    if (inputs.achievementMatch && inputs.achievementMatch.topScore < 0.4) {
        signals.push({
            severity: 'critical',
            category: 'achievement_match',
            message: 'Your achievement bank weakly matches this role. The output may read as generic — consider adding more role-relevant achievements before regenerating.',
        });
    }

    if (inputs.voiceScrubberFired && inputs.voiceScrubberFired.count > 0) {
        signals.push({
            severity: 'info',
            category: 'voice',
            message: `Voice scrubber corrected ${inputs.voiceScrubberFired.count} third-person violations automatically.`,
        });
    }

    return signals;
}
