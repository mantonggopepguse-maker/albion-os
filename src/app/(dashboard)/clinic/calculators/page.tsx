'use client';

import { useState, useMemo } from 'react';
import Topbar from '@/components/layout/Topbar';
import { calculateDrugDose, calculateFluidRate } from '@/lib/data-service';
import styles from './calculators.module.css';

interface DrugPreset {
  name: string;
  doseMgKg: number;
  concentrationMgMl: number;
}

const DRUG_PRESETS: DrugPreset[] = [
  { name: 'Amoxicillin-Clav (12.5 mg/kg, 50mg/mL)', doseMgKg: 12.5, concentrationMgMl: 50 },
  { name: 'Meloxicam NSAID (0.2 mg/kg, 5mg/mL)', doseMgKg: 0.2, concentrationMgMl: 5 },
  { name: 'Tramadol Analgesic (3.0 mg/kg, 50mg/mL)', doseMgKg: 3.0, concentrationMgMl: 50 },
  { name: 'Ceftriaxone (25.0 mg/kg, 100mg/mL)', doseMgKg: 25.0, concentrationMgMl: 100 },
  { name: 'Dexamethasone (0.15 mg/kg, 2mg/mL)', doseMgKg: 0.15, concentrationMgMl: 2 },
];

export default function ClinicalCalculatorsPage() {
  // Drug Dosage State
  const [drugWeightKg, setDrugWeightKg] = useState<number>(10);
  const [doseMgKg, setDoseMgKg] = useState<number>(12.5);
  const [concentrationMgMl, setConcentrationMgMl] = useState<number>(50);

  // Fluid Infusion State
  const [fluidWeightKg, setFluidWeightKg] = useState<number>(10);
  const [dehydrationPct, setDehydrationPct] = useState<number>(5);
  const [ongoingLossesMl, setOngoingLossesMl] = useState<number>(100);

  // Computed results
  const drugResult = useMemo(() => {
    return calculateDrugDose(drugWeightKg, doseMgKg, concentrationMgMl);
  }, [drugWeightKg, doseMgKg, concentrationMgMl]);

  const fluidResult = useMemo(() => {
    return calculateFluidRate(fluidWeightKg, dehydrationPct, ongoingLossesMl);
  }, [fluidWeightKg, dehydrationPct, ongoingLossesMl]);

  const applyDrugPreset = (p: DrugPreset) => {
    setDoseMgKg(p.doseMgKg);
    setConcentrationMgMl(p.concentrationMgMl);
  };

  return (
    <div className={styles.page}>
      <Topbar title="Clinical Veterinary Calculators" />

      <div className={styles.greeting}>
        <h1 className={styles.greetingText}>🧮 Clinical Dosage & Fluid Therapy Calculators</h1>
        <p className={styles.greetingSub}>
          Precision pharmaceutical volume math, multi-species weight scaling, and 24-hour IV infusion rate calculators
        </p>
      </div>

      <div className={styles.calcGrid}>
        {/* Calculator 1: Drug Dosage */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>💊 Medication Dosage Calculator</h2>
          <p className={styles.cardSubtitle}>
            Calculates exact total milligrams and liquid syringe volume to administer based on patient weight and drug concentration.
          </p>

          <div style={{ marginBottom: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            QUICK FORMULARY PRESETS:
          </div>
          <div className={styles.presetsRow}>
            {DRUG_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                className={styles.presetBtn}
                onClick={() => applyDrugPreset(p)}
              >
                {p.name.split(' (')[0]}
              </button>
            ))}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Patient Body Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              className={styles.input}
              value={drugWeightKg || ''}
              onChange={(e) => setDrugWeightKg(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Target Dose (mg / kg)</label>
            <input
              type="number"
              step="0.01"
              className={styles.input}
              value={doseMgKg || ''}
              onChange={(e) => setDoseMgKg(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Drug Concentration (mg / mL)</label>
            <input
              type="number"
              step="0.1"
              min="0.01"
              className={styles.input}
              value={concentrationMgMl || ''}
              onChange={(e) => setConcentrationMgMl(parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Result Output */}
          <div className={styles.resultBox}>
            <div className={styles.resultTitle}>ADMINISTRATION VOLUME REQUIRED</div>
            <div className={styles.resultMain}>{drugResult.volumeMl} mL</div>
            <div className={styles.resultDetails}>
              <div><strong>Total Active Dose:</strong> {drugResult.totalDoseMg} mg</div>
              <div><strong>Weight Scaled:</strong> {drugResult.weightKg} kg</div>
              <div><strong>Target Dosage:</strong> {drugResult.doseMgKg} mg/kg</div>
              <div><strong>Stock Conc:</strong> {drugResult.concentrationMgMl} mg/mL</div>
            </div>
          </div>
        </div>

        {/* Calculator 2: 24h Fluid Therapy */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>💧 24-Hour IV Fluid Therapy Infusion</h2>
          <p className={styles.cardSubtitle}>
            Calculates 24-hour baseline maintenance + dehydration deficit replacement + ongoing pathological losses.
          </p>

          <div style={{ marginBottom: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            DEHYDRATION CLINICAL SIGNS PRESETS:
          </div>
          <div className={styles.presetsRow}>
            <button type="button" className={styles.presetBtn} onClick={() => setDehydrationPct(0)}>
              0% Euvolemic
            </button>
            <button type="button" className={styles.presetBtn} onClick={() => setDehydrationPct(5)}>
              5% Mild (Dry MM)
            </button>
            <button type="button" className={styles.presetBtn} onClick={() => setDehydrationPct(7)}>
              7% Moderate (Loss of skin turgor)
            </button>
            <button type="button" className={styles.presetBtn} onClick={() => setDehydrationPct(10)}>
              10% Severe (Sunken eyes, weak pulses)
            </button>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Patient Body Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              className={styles.input}
              value={fluidWeightKg || ''}
              onChange={(e) => setFluidWeightKg(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Estimated Dehydration Deficit (%)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="15"
              className={styles.input}
              value={dehydrationPct || ''}
              onChange={(e) => setDehydrationPct(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Anticipated Ongoing Losses (mL / 24h)</label>
            <input
              type="number"
              step="10"
              min="0"
              className={styles.input}
              placeholder="e.g. 150 (Vomiting/diarrhea)"
              value={ongoingLossesMl || ''}
              onChange={(e) => setOngoingLossesMl(parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Fluid Result Output */}
          <div className={styles.resultFluidBox}>
            <div className={styles.resultFluidTitle}>INFUSION RATE PROTOCOL</div>
            <div className={styles.resultFluidMain}>{fluidResult.hourlyRateMlHr} mL/hr</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0369a1', marginBottom: '8px' }}>
              Infusion Drip Rate: ~{fluidResult.dropsPerMinute} drops/min (20 gtt/mL standard IV set)
            </div>
            <div className={styles.resultFluidDetails}>
              <div><strong>24h Total Volume:</strong> {fluidResult.total24hMl} mL</div>
              <div><strong>Maintenance (55mL/kg):</strong> {fluidResult.maintenanceMlDay} mL/day</div>
              <div><strong>Dehydration Deficit:</strong> {fluidResult.dehydrationDeficitMl} mL</div>
              <div><strong>Ongoing Losses:</strong> {fluidResult.ongoingLossesMlDay} mL</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
