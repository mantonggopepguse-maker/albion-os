import { NextResponse } from 'next/server';

interface LabInterpretRequest {
  patient?: {
    name?: string;
    species?: string;
    breed?: string;
    gender?: string;
  };
  test_type: string;
  clinical_notes?: string;
  parameters: Array<{
    parameter: string;
    value: string;
    unit?: string;
    reference_range?: string;
    status: 'low' | 'normal' | 'high' | 'critical';
  }>;
}

interface LabInterpretResponse {
  pathology_summary: string;
  clinical_impression: string;
  recommended_actions: string[];
  provider: 'gemini' | 'pathology_engine';
}

function getFallbackPathology(req: LabInterpretRequest): LabInterpretResponse {
  const abnormals = req.parameters.filter((p) => p.status !== 'normal');
  const abnormalNames = abnormals.map((p) => `${p.parameter} (${p.value} ${p.unit || ''}, ${p.status.toUpperCase()})`).join(', ');

  if (abnormals.length === 0) {
    return {
      pathology_summary: `All evaluated parameters for ${req.test_type.replace(/_/g, ' ')} are within physiological reference intervals. No acute hematological or biochemical deviations detected.`,
      clinical_impression: 'Unremarkable laboratory profile. Baseline physiological stability.',
      recommended_actions: [
        'Continue routine clinical monitoring.',
        'Correlate with physical exam findings.',
        'Repeat panel in 6-12 months as part of preventive wellness.'
      ],
      provider: 'pathology_engine'
    };
  }

  return {
    pathology_summary: `Laboratory evaluation of ${req.test_type.replace(/_/g, ' ')} demonstrates prominent deviations in: ${abnormalNames}. ${
      req.clinical_notes ? `Clinical context notes: ${req.clinical_notes}. ` : ''
    }These findings reflect systemic inflammatory response, organ dysregulation, or metabolic shifting requiring targeted therapeutic stabilization.`,
    clinical_impression: `Abnormal laboratory profile characterized by: ${abnormals.map((p) => p.parameter).join(', ')}. Differential considerations include acute reactive state, tissue hypoperfusion, or primary organ insult.`,
    recommended_actions: [
      'Initiate targeted medical therapy to address primary abnormalities.',
      'Maintain adequate fluid hydration and electrolyte balance.',
      'Re-check abnormal parameters in 48-72 hours to assess therapeutic trajectory.'
    ],
    provider: 'pathology_engine'
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LabInterpretRequest;

    if (!body.parameters || body.parameters.length === 0) {
      return NextResponse.json({ error: 'At least one lab parameter is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(getFallbackPathology(body));
    }

    const paramStr = body.parameters
      .map((p) => `- ${p.parameter}: ${p.value} ${p.unit || ''} (Ref: ${p.reference_range || 'N/A'}) [Flag: ${p.status.toUpperCase()}]`)
      .join('\n');

    const prompt = `You are a board-certified veterinary clinical pathologist. Interpret the following diagnostic laboratory results:
Patient: ${body.patient?.name || 'Pet'} (${body.patient?.species || 'Canine'}, ${body.patient?.breed || 'Mixed'})
Panel: ${body.test_type.replace(/_/g, ' ')}
Clinical History / Notes: ${body.clinical_notes || 'None provided'}

Measured Laboratory Parameters:
${paramStr}

Provide an expert pathology interpretation for the attending veterinarian.
Return STRICTLY a JSON object with this exact schema:
{
  "pathology_summary": string,
  "clinical_impression": string,
  "recommended_actions": string[]
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
      console.warn('Gemini API returned error, falling back to pathology engine');
      return NextResponse.json(getFallbackPathology(body));
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return NextResponse.json(getFallbackPathology(body));
    }

    const parsed = JSON.parse(rawText);
    return NextResponse.json({
      ...parsed,
      provider: 'gemini',
    });
  } catch (err: any) {
    console.error('Error in AI lab interpret endpoint:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal AI pathology interpreter error' },
      { status: 500 }
    );
  }
}
