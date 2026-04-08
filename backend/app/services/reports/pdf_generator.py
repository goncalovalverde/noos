from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import io
from datetime import datetime
from typing import List, Dict, Any
from app.services.reports.raw_data_labels import format_raw_data

BRAND_PURPLE = colors.HexColor('#4B164F')
BRAND_MID = colors.HexColor('#9839D1')
BRAND_ACCENT = colors.HexColor('#B738F2')

COLOR_SUPERIOR = colors.HexColor('#16a34a')    # green-600
COLOR_NORMAL = colors.HexColor('#2563eb')      # blue-600
COLOR_BORDERLINE = colors.HexColor('#d97706')  # amber-600
COLOR_DEFICIT = colors.HexColor('#dc2626')     # red-600
COLOR_LIGHT_GRAY = colors.HexColor('#f3f4f6')

def _classification_color(clasificacion: str):
    mapping = {
        'Superior': COLOR_SUPERIOR,
        'Normal': COLOR_NORMAL,
        'Limítrofe': COLOR_BORDERLINE,
        'Deficitario': COLOR_DEFICIT,
    }
    return mapping.get(clasificacion, colors.black)

def generate_pdf_report(
    patient: Dict[str, Any],
    sessions: List[Dict[str, Any]],
    plan: Dict[str, Any] | None = None,
    protocol_name: str | None = None,
) -> bytes:
    """
    Generate a PDF report and return bytes.
    patient: {id, display_id, age, education_years, laterality, created_at}
    sessions: list of {test_type, date, calculated_scores, raw_data, qualitative_data}
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm
    )
    styles = getSampleStyleSheet()
    story = []

    # Header
    title_style = ParagraphStyle('Title', fontSize=18, textColor=BRAND_PURPLE, spaceAfter=4, fontName='Helvetica-Bold')
    subtitle_style = ParagraphStyle('Subtitle', fontSize=10, textColor=colors.gray, spaceAfter=12)
    story.append(Paragraph("Nóos — Informe Neuropsicológico", title_style))
    story.append(Paragraph(f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BRAND_PURPLE, spaceAfter=12))

    # Patient info
    section_style = ParagraphStyle('Section', fontSize=12, textColor=BRAND_PURPLE, spaceBefore=12, spaceAfter=6, fontName='Helvetica-Bold')
    normal_style = ParagraphStyle('Normal', fontSize=10, spaceAfter=4)
    story.append(Paragraph("Datos del Paciente", section_style))
    laterality_map = {'diestro': 'Diestro', 'zurdo': 'Zurdo', 'ambidextro': 'Ambidextro'}
    patient_data = [
        ["ID Paciente", patient.get('display_id', patient.get('id', '—'))],
        ["Edad", f"{patient.get('age', '—')} años"],
        ["Escolaridad", f"{patient.get('education_years', '—')} años"],
        ["Lateralidad", laterality_map.get(patient.get('laterality', ''), patient.get('laterality', '—'))],
    ]
    if protocol_name:
        patient_data.append(["Protocolo", protocol_name])
    patient_table = Table(patient_data, colWidths=[4*cm, 12*cm])
    patient_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [COLOR_LIGHT_GRAY, colors.white]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(patient_table)
    story.append(Spacer(1, 12))

    # Results table
    story.append(Paragraph("Resultados de las Pruebas", section_style))
    header = ["Prueba", "PE", "Percentil", "Z-Score", "Clasificación"]
    rows = [header]
    for s in sessions:
        cs = s.get('calculated_scores') or {}
        pe = cs.get('puntuacion_escalar', '—')
        pct = cs.get('percentil', '—')
        z = cs.get('z_score', '—')
        cls_ = cs.get('clasificacion', '—')
        rows.append([
            s.get('test_type', '—'),
            str(pe),
            f"{pct:.1f}" if isinstance(pct, float) else str(pct),
            f"{z:.2f}" if isinstance(z, float) else str(z),
            cls_,
        ])
    col_widths = [5*cm, 2*cm, 2.5*cm, 2.5*cm, 4*cm]
    results_table = Table(rows, colWidths=col_widths)
    table_style = [
        ('BACKGROUND', (0,0), (-1,0), BRAND_PURPLE),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [COLOR_LIGHT_GRAY, colors.white]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('PADDING', (0,0), (-1,-1), 6),
    ]
    # Color classification column
    for i, s in enumerate(sessions, 1):
        cs = s.get('calculated_scores') or {}
        cls_ = cs.get('clasificacion', '')
        col = _classification_color(cls_)
        table_style.append(('TEXTCOLOR', (4, i), (4, i), col))
        table_style.append(('FONTNAME', (4, i), (4, i), 'Helvetica-Bold'))
    results_table.setStyle(TableStyle(table_style))
    story.append(results_table)

    # Qualitative notes
    has_notes = any(
        (s.get('qualitative_data') or {}).get('observaciones')
        for s in sessions
    )
    if has_notes:
        story.append(Spacer(1, 12))
        story.append(Paragraph("Observaciones Clínicas", section_style))
        for s in sessions:
            qd = s.get('qualitative_data') or {}
            obs = qd.get('observaciones', '').strip()
            if obs:
                story.append(Paragraph(f"<b>{s.get('test_type')}:</b> {obs}", normal_style))

    # Raw data per test
    story.append(Spacer(1, 12))
    story.append(Paragraph("Datos Introducidos por Prueba", section_style))
    small_style = ParagraphStyle('Small', fontSize=9, textColor=colors.gray, spaceBefore=0, spaceAfter=2)
    for s in sessions:
        test_type = s.get('test_type', '—')
        raw = s.get('raw_data') or {}
        rows_data = format_raw_data(test_type, raw)
        if not rows_data:
            continue
        story.append(Paragraph(f"<b>{test_type}</b>", normal_style))
        tbl_data = [[lbl, val] for lbl, val in rows_data]
        raw_tbl = Table(tbl_data, colWidths=[6*cm, 10*cm])
        raw_tbl.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#4B164F')),
            ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.HexColor('#faf5ff'), colors.white]),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.lightgrey),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(raw_tbl)
        story.append(Spacer(1, 6))

    # Footer
    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey, spaceAfter=6))
    footer_style = ParagraphStyle('Footer', fontSize=8, textColor=colors.gray, alignment=TA_CENTER)
    story.append(Paragraph("Nóos — Triune Neuropsicología · Informe generado automáticamente", footer_style))

    doc.build(story)
    return buffer.getvalue()
