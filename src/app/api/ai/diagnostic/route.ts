import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from '@/lib/supabase/config';

interface DiagnosticRequest {
  patient?: {
    name?: string;
    species?: string;
    breed?: string;
    gender?: string;
    age_years?: number;
    weight_kg?: number;
  };
  chief_complaint: string;
  clinical_notes?: string;
}

interface DiagnosticResponse {
  differential_diagnoses: Array<{
    diagnosis: string;
    confidence: number;
    rationale: string;
  }>;
  suggested_assessment: string;
  suggested_plan: string;
  recommended_tests: string[];
  suggested_medications: string[];
  provider: 'gemini' | 'clinical_engine';
}

function getFallbackDiagnosis(req: DiagnosticRequest): DiagnosticResponse {
  const complaint = (req.chief_complaint + ' ' + (req.clinical_notes || '')).toLowerCase();
  const species = req.patient?.species?.toLowerCase() || 'canine';

  if (complaint.includes('vomit') || complaint.includes('diarrhea') || complaint.includes('stool')) {
    if (species.includes('cat') || species.includes('feline')) {
      return {
        differential_diagnoses: [
          { diagnosis: 'Feline Panleukopenia / Viral Enteritis', confidence: 75, rationale: 'Acute vomiting and diarrhea in feline patient, high risk if unvaccinated.' },
          { diagnosis: 'Dietary Indiscretion / Gastroenteritis', confidence: 60, rationale: 'Ingestion of non-dietary substance or sudden feed switch.' },
          { diagnosis: 'Gastrointestinal Foreign Body Obstruction', confidence: 45, rationale: 'Common in curious domestic felines; requires abdominal radiograph.' }
        ],
        suggested_assessment: 'Acute gastroenteritis syndrome with dehydration risk. Rule out viral enteritis and foreign body.',
        suggested_plan: '1. Fast for 12h, initiate balanced isotonic IV fluid therapy (Lactated Ringer).\n2. Antiemetic: Maropitant (Cerenia) 1mg/kg SQ.\n3. Broad-spectrum GI support: Metronidazole 10mg/kg BID.\n4. Perform abdominal ultrasound/radiographs if vomiting persists.',
        recommended_tests: ['Complete Blood Count (CBC)', 'Feline Parvovirus / Panleukopenia Rapid Antigen Test', 'Abdominal Radiographs', 'Serum Electrolytes'],
        suggested_medications: ['Maropitant (Cerenia) Inj', 'Metronidazole Oral Suspension', 'Lactated Ringer Solution', 'Probiotic Paste'],
        provider: 'clinical_engine'
      };
    }
    return {
      differential_diagnoses: [
        { diagnosis: 'Canine Parvoviral Enteritis (CPV)', confidence: 80, rationale: 'Hallmark signs of hemorrhagic diarrhea, vomiting, anorexia, and dehydration in canines.' },
        { diagnosis: 'Acute Hemorrhagic Gastroenteritis (HGE / AHDS)', confidence: 65, rationale: 'Sudden onset vomiting and bloody bowel discharge with hemoconcentration.' },
        { diagnosis: 'Helminthic Endoparasitism (Hookworms/Giardia)', confidence: 50, rationale: 'Common enteric parasite burden in tropical/subtropical regions.' }
      ],
      suggested_assessment: 'Suspected acute viral enteritis (CPV) vs severe hemorrhagic gastroenteritis with secondary dehydration.',
      suggested_plan: '1. Strict isolation protocol.\n2. Aggressive IV fluid resuscitation (Hartmann solution + 5% Dextrose).\n3. Antiemetic therapy (Maropitant 1mg/kg SQ SID).\n4. Broad-spectrum antimicrobial coverage (Amoxicillin-Clavulanate + Cefotaxime).\n5. Pain management (Buprenorphine 0.02mg/kg IM).',
      recommended_tests: ['CPV Rapid Antigen Snap Test', 'Packed Cell Volume (PCV) & Total Solids', 'Complete Blood Count (CBC)', 'Fecal Floatation & Smear'],
      suggested_medications: ['Cerenia (Maropitant) 10mg/ml', 'Hartmann IV Infusion 500ml', 'Cefotaxime Sodium Inj', 'Metronidazole 500mg/100ml IV', 'Sucralfate Suspension'],
      provider: 'clinical_engine'
    };
  }

  if (complaint.includes('cough') || complaint.includes('breath') || complaint.includes('respirat') || complaint.includes('sneez')) {
    return {
      differential_diagnoses: [
        { diagnosis: 'Infectious Tracheobronchitis (Kennel Cough)', confidence: 78, rationale: 'Dry paroxysmal retching cough aggravated by excitement or tracheal palpation.' },
        { diagnosis: 'Canine Heartworm Disease (Dirofilaria immitis)', confidence: 62, rationale: 'Cardiopulmonary parasite transmission via mosquito vector in endemic areas.' },
        { diagnosis: 'Bacterial Bronchopneumonia', confidence: 48, rationale: 'Productive moist cough with systemic pyrexia and adventitious lung sounds.' }
      ],
      suggested_assessment: 'Upper respiratory tract syndrome with persistent paroxysmal tracheobronchial irritation.',
      suggested_plan: '1. Restrict exercise and switch neck collar to chest harness.\n2. Doxycycline 10mg/kg PO SID with food for 14 days.\n3. Antitussive therapy: Dextromethorphan or Butorphanol if non-productive.\n4. Nebulization with saline twice daily.',
      recommended_tests: ['Thoracic Radiographs (2-view)', 'Heartworm Antigen Rapid Test', 'Airway Cytology / Transtracheal Wash'],
      suggested_medications: ['Doxycycline 100mg Tablets', 'Meloxicam 0.1mg/kg Oral', 'Normal Saline for Nebulizer', 'Vitamin C Supplement'],
      provider: 'clinical_engine'
    };
  }

  if (complaint.includes('scratch') || complaint.includes('skin') || complaint.includes('hair') || complaint.includes('itch') || complaint.includes('flea') || complaint.includes('tick')) {
    return {
      differential_diagnoses: [
        { diagnosis: 'Flea Allergy Dermatitis (FAD) & Tick Infestation', confidence: 82, rationale: 'Dorsal lumbosacral alopecia, intense pruritus, and ectoparasite exposure.' },
        { diagnosis: 'Canine Demodicosis / Sarcoptic Mange', confidence: 64, rationale: 'Follicular mites causing alopecic crusting patches and secondary pyoderma.' },
        { diagnosis: 'Superficial Bacterial Folliculitis / Malassezia Dermatitis', confidence: 55, rationale: 'Secondary microbial overgrowth in warm humid conditions.' }
      ],
      suggested_assessment: 'Pruritic dermatopathy with secondary superficial pyoderma and ectoparasitic involvement.',
      suggested_plan: '1. Administer modern isoxazoline ectoparasiticide (Afoxolaner / Fluralaner / Sarolaner).\n2. Medicated bath using 2-4% Chlorhexidine + Ketoconazole shampoo twice weekly.\n3. Antipruritic therapy: Apoquel (Oclacitinib) 0.4-0.6mg/kg PO BID for 14 days.\n4. Environmental premise spray for flea/tick elimination.',
      recommended_tests: ['Deep & Superficial Skin Scrapings', 'Acetate Tape Impression Cytology', 'Wood\'s Lamp Examination'],
      suggested_medications: ['Bravecto / NexGard Chews', 'Chlorhexidine 4% Medicated Wash', 'Apoquel 5.4mg / 16mg Tablets', 'Cephalexin 500mg Caps'],
      provider: 'clinical_engine'
    };
  }

  // Default general clinical evaluation
  return {
    differential_diagnoses: [
      { diagnosis: 'Systemic Febrile Illness / Inflammatory State', confidence: 65, rationale: 'Nonspecific malaise, dull mentation, hyporexia, and elevated core temperature.' },
      { diagnosis: 'Tick-borne Hemoparasitism (Babesiosis / Ehrlichiosis)', confidence: 58, rationale: 'High regional prevalence of vector-borne intracellular pathogens.' },
      { diagnosis: 'Subclinical Metabolic Dysregulation (Hepatorenal)', confidence: 42, rationale: 'Common underlying driver in adult to geriatric veterinary companions.' }
    ],
    suggested_assessment: 'Undifferentiated acute febrile illness with mild lethargy and hyporexia.',
    suggested_plan: '1. Baseline diagnostic workup: hematology, blood smear examination, and biochemistry.\n2. Supportive subcutaneous or IV crystalloid fluid rehydration.\n3. Antipyretic/NSAID therapy (Meloxicam 0.1mg/kg SQ once hydration assured).\n4. Re-evaluate patient in 24-48 hours with laboratory results.',
    recommended_tests: ['Complete Blood Count (CBC)', 'Giemsa-Stained Blood Film (Hemoparasite screen)', 'Comprehensive Chemistry Panel (ALT, BUN, Creatinine)', 'Urinalysis'],
    suggested_medications: ['Meloxicam Injectable 5mg/ml', 'Lactated Ringer 500ml', 'Multivitamin & B-Complex Injection', 'Broad-Spectrum Doxycycline'],
    provider: 'clinical_engine'
  };
}

export async function POST(req: Request) {
  try {
    // ── Server-side auth check (defense-in-depth) ──
    const { url, anonKey } = getSupabaseConfig();
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* read-only in route handlers */ },
      },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = (await req.json()) as DiagnosticRequest;

    if (!body.chief_complaint || !body.chief_complaint.trim()) {
      return NextResponse.json({ error: 'Chief complaint is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Return clinical engine fallback
      return NextResponse.json(getFallbackDiagnosis(body));
    }

    // Call Google Gemini API
    const prompt = `You are an expert veterinary clinical copilot assisting a licensed veterinary surgeon.
Patient Context:
- Name: ${body.patient?.name || 'Unknown'}
- Species: ${body.patient?.species || 'Canine'}
- Breed: ${body.patient?.breed || 'Mixed'}
- Gender: ${body.patient?.gender || 'Unknown'}
- Weight: ${body.patient?.weight_kg || 'Unknown'} kg
- Chief Complaint: ${body.chief_complaint}
- Clinical Examination Notes: ${body.clinical_notes || 'None provided'}

Provide an evidence-based clinical differential diagnosis and SOAP recommendations.
Return STRICTLY a JSON object with this exact schema:
{
  "differential_diagnoses": [
    { "diagnosis": string, "confidence": number (0-100), "rationale": string }
  ],
  "suggested_assessment": string,
  "suggested_plan": string,
  "recommended_tests": string[],
  "suggested_medications": string[]
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      }
    );

    if (!res.ok) {
      console.warn('Gemini API call returned non-200, using clinical fallback engine');
      return NextResponse.json(getFallbackDiagnosis(body));
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return NextResponse.json(getFallbackDiagnosis(body));
    }

    const parsed = JSON.parse(rawText);
    return NextResponse.json({
      ...parsed,
      provider: 'gemini',
    });
  } catch (err: any) {
    console.error('Error in AI diagnostic endpoint:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal AI diagnostic error' },
      { status: 500 }
    );
  }
}
