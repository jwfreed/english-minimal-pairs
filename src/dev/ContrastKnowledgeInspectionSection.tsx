import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAllThemeColors } from '@/src/context/theme';
import { getContrastProgress } from '@/src/storage/contrastProgressStorage';
import {
  buildContrastKnowledgeInspectionReport,
  CONTRAST_KNOWLEDGE_INSPECTION_MINIMUM,
  type ContrastKnowledgeInspectionReport,
  type ContrastKnowledgeInspectionReportEntry,
} from '@/src/dev/contrastKnowledgeInspectionReport';

interface ContrastKnowledgeInspectionSectionProps {
  readonly categoryLabel: string;
}

type InspectionState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'report';
      readonly report: ContrastKnowledgeInspectionReport;
    };

function hasObservations(
  entry: ContrastKnowledgeInspectionReportEntry
): entry is Extract<
  ContrastKnowledgeInspectionReportEntry,
  { standing: 'insufficient' | 'observed' }
> {
  return (
    entry.standing === 'insufficient' || entry.standing === 'observed'
  );
}

export function ContrastKnowledgeInspectionSection({
  categoryLabel,
}: ContrastKnowledgeInspectionSectionProps) {
  const theme = useAllThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [state, setState] = useState<InspectionState>({
    status: 'loading',
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    getContrastProgress()
      .then((projection) => {
        if (cancelled) return;
        setState({
          status: 'report',
          report: buildContrastKnowledgeInspectionReport({
            projection,
            categoryLabel,
            evaluationTimestamp: Date.now(),
            minimumAttributedAttemptCount:
              CONTRAST_KNOWLEDGE_INSPECTION_MINIMUM,
          }),
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message:
            error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [categoryLabel]);

  if (state.status === 'loading') {
    return (
      <View style={styles.section}>
        <Text style={styles.title}>ContrastKnowledge inspection</Text>
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.secondaryText}>Reading retained evidence…</Text>
        </View>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.section}>
        <Text style={styles.title}>ContrastKnowledge inspection</Text>
        <Text style={styles.errorText}>Read error: {state.message}</Text>
      </View>
    );
  }

  if (state.report.status === 'unavailable') {
    return (
      <View style={styles.section}>
        <Text style={styles.title}>ContrastKnowledge inspection</Text>
        <Text style={styles.errorText}>Inspection unavailable</Text>
        <Text style={styles.secondaryText}>
          Category label: {state.report.categoryLabel}
        </Text>
        <Text style={styles.secondaryText}>
          Reason: {state.report.reason}
        </Text>
      </View>
    );
  }

  const report = state.report;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>ContrastKnowledge inspection</Text>
      <Text style={styles.policyText}>
        Developer-only policy; not a learner or adaptive threshold.
      </Text>

      <View style={styles.diagnosticsBlock}>
        <Text style={styles.blockTitle}>Global diagnostics</Text>
        <Text style={styles.valueText}>
          Evidence scope: {report.evidenceScope}
        </Text>
        <Text style={styles.valueText}>
          Active category: {report.categoryLabel}
        </Text>
        <Text style={styles.valueText}>
          Active LanguageId: {report.languageId}
        </Text>
        <Text style={styles.valueText}>
          Completeness: {report.diagnostics.completeness}
        </Text>
        <Text style={styles.valueText}>
          Global attributed retained attempts:{' '}
          {report.globalAttributedRetainedAttemptCount}
        </Text>
        <Text style={styles.valueText}>
          Unmapped entries: {report.diagnostics.unmappedEntryCount}
        </Text>
        <Text style={styles.valueText}>
          Malformed entries: {report.diagnostics.malformedEntryCount}
        </Text>
        <Text style={styles.valueText}>
          Malformed attempts: {report.diagnostics.malformedAttemptCount}
        </Text>
        <Text style={styles.valueText}>
          Developer inspection minimum:{' '}
          {report.developerInspectionMinimum} retained attempts
        </Text>
        <Text style={styles.noteText}>
          Completeness covers the entire stored projection. Evidence from
          any language can make active-language rows indeterminate.
        </Text>
        <Text style={styles.noteText}>
          Counts are retained evidence, not lifetime totals.
        </Text>
      </View>

      <View style={styles.censusBlock}>
        <Text style={styles.blockTitle}>Standing census</Text>
        <Text style={styles.valueText}>
          indeterminate: {report.standingCensus.indeterminate}
        </Text>
        <Text style={styles.valueText}>
          unobserved: {report.standingCensus.unobserved}
        </Text>
        <Text style={styles.valueText}>
          insufficient: {report.standingCensus.insufficient}
        </Text>
        <Text style={styles.valueText}>
          observed: {report.standingCensus.observed}
        </Text>
      </View>

      <Text style={styles.noteText}>Recency is an observation only.</Text>

      {report.entries.map((entry) => (
        <View key={entry.contrastId} style={styles.contrastRow}>
          <Text style={styles.contrastLabel}>{entry.label}</Text>
          <Text style={styles.identityText}>{entry.contrastId}</Text>
          <Text style={styles.valueText}>Standing: {entry.standing}</Text>
          {hasObservations(entry) && (
            <>
              <Text style={styles.valueText}>
                Attributed retained attempts:{' '}
                {entry.attributedRetainedAttemptCount}
              </Text>
              <Text style={styles.valueText}>
                Correct retained attempts: {entry.correctCount}
              </Text>
              <Text style={styles.valueText}>
                Recency observation: {entry.recency.displayText}
              </Text>
              <Text style={styles.identityText}>
                Raw milliseconds: {entry.recency.elapsedMilliseconds}
              </Text>
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const createStyles = (
  theme: ReturnType<typeof useAllThemeColors>
) =>
  StyleSheet.create({
    section: {
      padding: 16,
      borderRadius: 18,
      marginBottom: 12,
      backgroundColor: theme.surface,
    },
    title: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 4,
    },
    policyText: {
      color: theme.textSecondary,
      fontSize: 12,
      marginBottom: 12,
    },
    diagnosticsBlock: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.surfaceTint,
      marginBottom: 12,
    },
    censusBlock: {
      paddingBottom: 12,
    },
    blockTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 6,
    },
    valueText: {
      color: theme.text,
      fontSize: 12,
      lineHeight: 18,
    },
    secondaryText: {
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    noteText: {
      color: theme.textSecondary,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 6,
    },
    errorText: {
      color: theme.error,
      fontSize: 12,
      lineHeight: 18,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    contrastRow: {
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.hairline,
    },
    contrastLabel: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    identityText: {
      color: theme.textSecondary,
      fontSize: 11,
      lineHeight: 16,
    },
  });
