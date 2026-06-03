from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from datetime import datetime
from io import BytesIO

def gerar_pdf_relatorio_geral(usuarios, projetos, submissoes, ratings):
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=letter, 
        rightMargin=40, 
        leftMargin=40, 
        topMargin=40, 
        bottomMargin=40
    )
    story = []
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'RepTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#7A1BB5'),
        alignment=1, # Center
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        'RepSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#555555'),
        alignment=1,
        spaceAfter=25
    )
    
    section_style = ParagraphStyle(
        'RepSection',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#7A1BB5'),
        spaceBefore=15,
        spaceAfter=10,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'RepBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#333333'),
        spaceAfter=8
    )
    
    table_header_style = ParagraphStyle(
        'RepTableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=12,
        textColor=colors.white,
        alignment=1
    )
    
    table_cell_style = ParagraphStyle(
        'RepTableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        alignment=1
    )

    # Document Header
    story.append(Paragraph("RELATÓRIO GERENCIAL DE PROJETOS E EXTENSÃO", title_style))
    data_emissao = datetime.now().strftime('%d/%m/%Y às %H:%M')
    story.append(Paragraph(f"SisCPTI · Emitido em {data_emissao} · Brasília - DF", subtitle_style))
    story.append(Spacer(1, 10))
    
    # Overview metrics
    total_users = len(usuarios)
    total_projects = len(projetos)
    total_submissions = len(submissoes)
    total_ratings = len(ratings)
    avg_rating = round(sum(r.nota for r in ratings) / total_ratings, 2) if total_ratings > 0 else 0
    
    story.append(Paragraph("1. Visão Geral da Plataforma", section_style))
    story.append(Paragraph("Abaixo estão consolidados os principais indicadores de participação de alunos, mentores e andamento de projetos de tecnologia do UniCEUB.", body_style))
    
    overview_data = [
        [
            Paragraph("<b>Métrica</b>", table_header_style),
            Paragraph("<b>Total Registrado</b>", table_header_style)
        ],
        [Paragraph("Usuários Cadastrados", table_cell_style), Paragraph(str(total_users), table_cell_style)],
        [Paragraph("Projetos Criados", table_cell_style), Paragraph(str(total_projects), table_cell_style)],
        [Paragraph("Propostas Recebidas", table_cell_style), Paragraph(str(total_submissions), table_cell_style)],
        [Paragraph("Avaliações de Satisfação Recebidas", table_cell_style), Paragraph(str(total_ratings), table_cell_style)],
        [Paragraph("Média Geral de Notas (1-5)", table_cell_style), Paragraph(f"{avg_rating} ⭐", table_cell_style)]
    ]
    
    t_overview = Table(overview_data, colWidths=[300, 200])
    t_overview.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#7A1BB5')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#DDDDDD')),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#F9F9F9')),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_overview)
    story.append(Spacer(1, 20))
    
    # Multidimensional satisfaction breakdown
    story.append(Paragraph("2. Médias de Satisfação por Categoria", section_style))
    story.append(Paragraph("As avaliações recebidas são segmentadas em quatro dimensões principais de qualidade:", body_style))
    
    avg_org = round(sum(r.nota_organizacao or 5 for r in ratings) / total_ratings, 2) if total_ratings > 0 else 0
    avg_ori = round(sum(r.nota_orientacao or 5 for r in ratings) / total_ratings, 2) if total_ratings > 0 else 0
    avg_apr = round(sum(r.nota_aprendizado or 5 for r in ratings) / total_ratings, 2) if total_ratings > 0 else 0
    
    def format_bar(val):
        pct = int((val / 5.0) * 100)
        # Safe ASCII progress bar
        filled = "=" * int(pct/10)
        empty = " " * (10 - len(filled))
        return f"[{filled}{empty}] {val}/5"

    sat_data = [
        [
            Paragraph("<b>Dimensão Avaliada</b>", table_header_style),
            Paragraph("<b>Nota Média (1-5)</b>", table_header_style),
            Paragraph("<b>Progresso Visual</b>", table_header_style)
        ],
        [Paragraph("Geral", table_cell_style), Paragraph(str(avg_rating), table_cell_style), Paragraph(format_bar(avg_rating), table_cell_style)],
        [Paragraph("Organização do Time", table_cell_style), Paragraph(str(avg_org), table_cell_style), Paragraph(format_bar(avg_org), table_cell_style)],
        [Paragraph("Qualidade da Orientação", table_cell_style), Paragraph(str(avg_ori), table_cell_style), Paragraph(format_bar(avg_ori), table_cell_style)],
        [Paragraph("Nível de Aprendizado", table_cell_style), Paragraph(str(avg_apr), table_cell_style), Paragraph(format_bar(avg_apr), table_cell_style)]
    ]
    
    t_sat = Table(sat_data, colWidths=[200, 120, 180])
    t_sat.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#7A1BB5')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#DDDDDD')),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#F9F9F9')),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_sat)
    story.append(Spacer(1, 20))
    
    # Active projects list
    story.append(Paragraph("3. Projetos Acadêmicos Ativos", section_style))
    story.append(Paragraph("Abaixo estão listados os projetos em execução no corrente período:", body_style))
    
    proj_header = [
        [
            Paragraph("<b>ID</b>", table_header_style),
            Paragraph("<b>Título do Projeto</b>", table_header_style),
            Paragraph("<b>Professor Orientador</b>", table_header_style),
            Paragraph("<b>Status</b>", table_header_style)
        ]
    ]
    for p in projetos[:10]: # Limit to top 10 for pagination / page size safety
        status_text = p.status
        proj_header.append([
            Paragraph(f"#{p.id}", table_cell_style),
            Paragraph(p.titulo, table_cell_style),
            Paragraph(p.professor or 'Sem Orientador', table_cell_style),
            Paragraph(status_text, table_cell_style)
        ])
        
    t_proj = Table(proj_header, colWidths=[50, 200, 150, 100])
    t_proj.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#7A1BB5')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#DDDDDD')),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#F9F9F9')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_proj)
    
    if len(projetos) > 10:
        story.append(Spacer(1, 5))
        story.append(Paragraph(f"<i>* Exibindo 10 de {len(projetos)} projetos ativos no total.</i>", body_style))
        
    story.append(Spacer(1, 40))
    
    # Signature line
    sig_style = ParagraphStyle(
        'RepSig',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        alignment=1
    )
    
    sig_table_data = [
        [
            Paragraph("_____________________________<br/>Coordenação Acadêmica de TI<br/>UniCEUB", sig_style),
            Paragraph("_____________________________<br/>Secretaria de Extensão<br/>SisCPTI", sig_style)
        ]
    ]
    sig_table = Table(sig_table_data, colWidths=[250, 250])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(sig_table)
    
    # Border decorator
    def draw_report_border(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor('#7A1BB5'))
        canvas.setLineWidth(2)
        canvas.rect(20, 20, doc.pagesize[0]-40, doc.pagesize[1]-40)
        canvas.restoreState()
        
    doc.build(story, onFirstPage=draw_report_border)
    buffer.seek(0)
    return buffer.getvalue()
