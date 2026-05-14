import os
import tempfile
import uuid
from fastapi import APIRouter
from fastapi.responses import FileResponse
from pydantic import BaseModel
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import letter

router = APIRouter()

class ExportPDFInput(BaseModel):
    questions: list[str]

def generate_pdf(questions: list[str]) -> str:
    temp_dir = tempfile.gettempdir()
    filename = f"generated_paper_{uuid.uuid4().hex[:8]}.pdf"
    file_path = os.path.join(temp_dir, filename)

    doc = SimpleDocTemplate(file_path, pagesize=letter)
    styles = getSampleStyleSheet()
    title_style = styles["Heading1"]
    body_style = styles["Normal"]
    body_style.spaceAfter = 12
    body_style.leading = 14

    story = []

    # Title
    story.append(Paragraph("Generated Question Paper", title_style))
    story.append(Spacer(1, 20))

    # Questions
    for i, q in enumerate(questions, 1):
        cleaned_text = q.replace("\n", "<br/>") 
        paragraph = Paragraph(f"<b>{i}.</b> {cleaned_text}", body_style)
        story.append(paragraph)
        story.append(Spacer(1, 10))

    doc.build(story)
    return file_path

@router.post("/export-pdf")
async def export_pdf(input_data: ExportPDFInput):
    if not input_data.questions:
        return {"detail": "No questions provided."}
    
    file_path = generate_pdf(input_data.questions)
    
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename="generated_paper.pdf"
    )
