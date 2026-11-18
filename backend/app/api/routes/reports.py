import csv
import io
import json
from uuid import UUID
from xml.sax.saxutils import escape

from fastapi import APIRouter, HTTPException, Response, status
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select

from backend.app.api.deps import CurrentUser, DbSession
from backend.app.api.routes.simulations import _accessible_run
from backend.app.api.schemas import ReportCreate, ReportRead
from backend.app.db.models import Environment, Experiment, Report, Scenario

router = APIRouter(tags=["reports"])


def _render_report(snapshot: dict, output_format: str) -> tuple[bytes, str, str]:
    if output_format == "json":
        return (
            json.dumps(snapshot, indent=2, ensure_ascii=False).encode("utf-8"),
            "application/json",
            "json",
        )
    if output_format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["section", "name", "value"])
        writer.writerow(["experiment", "title", snapshot["experiment"]["title"]])
        writer.writerow(["experiment", "objective", snapshot["experiment"]["objective"]])
        for name, value in snapshot["configuration"].items():
            writer.writerow(["configuration", name, value])
        for name, value in snapshot["metrics"].items():
            writer.writerow(["metrics", name, value])
        return output.getvalue().encode("utf-8"), "text/csv; charset=utf-8", "csv"

    output = io.BytesIO()
    document = SimpleDocTemplate(output, pagesize=letter, title=snapshot["title"])
    styles = getSampleStyleSheet()
    story = [Paragraph(escape(snapshot["title"]), styles["Title"]), Spacer(1, 14)]
    story.append(
        Paragraph(
            escape(snapshot["experiment"]["objective"] or "No objective provided."),
            styles["BodyText"],
        )
    )
    story.append(Spacer(1, 12))
    rows = [["Metric", "Value"]]
    rows.extend([[str(name), str(value)] for name, value in snapshot["metrics"].items()])
    table = Table(rows, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#172b4d")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
                ("PADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.extend([table, Spacer(1, 12)])
    story.append(Paragraph("Assumptions and limitations", styles["Heading2"]))
    for assumption in snapshot.get("assumptions", []):
        story.append(Paragraph(f"• {escape(str(assumption))}", styles["BodyText"]))
    story.append(Spacer(1, 12))
    story.append(
        Paragraph(f"Configuration: {escape(json.dumps(snapshot['configuration']))}", styles["Code"])
    )
    document.build(story)
    return output.getvalue(), "application/pdf", "pdf"


@router.post(
    "/runs/{run_id}/reports",
    response_model=ReportRead,
    status_code=status.HTTP_201_CREATED,
)
def create_report(
    run_id: UUID, payload: ReportCreate, user: CurrentUser, db: DbSession
) -> Report:
    run = _accessible_run(db, user.id, run_id)
    if run.status != "completed" or not run.metrics:
        raise HTTPException(status_code=409, detail="Reports require a completed simulation")
    scenario = db.get(Scenario, run.scenario_id)
    experiment = db.get(Experiment, scenario.experiment_id)
    environment_name = None
    if experiment.environment_id:
        environment = db.get(Environment, experiment.environment_id)
        environment_name = environment.name if environment else None
    snapshot = {
        "title": f"Results: {experiment.title} — {scenario.name}",
        "experiment": {
            "title": experiment.title,
            "objective": experiment.objective,
            "domain": experiment.domain,
            "environment": environment_name,
        },
        "scenario": {"name": scenario.name, "version": run.scenario_version},
        "simulation": {
            "run_id": str(run.id),
            "engine": run.engine,
            "engine_version": run.engine_version,
            "seed": run.seed,
            "experiment_version": run.experiment_version,
        },
        "configuration": run.config,
        "metrics": run.metrics,
        "assumptions": run.metrics.get("assumptions", []),
        "uncertainty": "Results are outputs of the configured simulation model, not factual predictions.",
    }
    report = Report(
        run_id=run.id,
        created_by_id=user.id,
        title=snapshot["title"],
        format=payload.format,
        snapshot=snapshot,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/reports/{report_id}", response_model=ReportRead)
def get_report(report_id: UUID, user: CurrentUser, db: DbSession) -> Report:
    report = db.scalar(select(Report).where(Report.id == report_id))
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    _accessible_run(db, user.id, report.run_id)
    return report


@router.get("/reports/{report_id}/download")
def download_report(report_id: UUID, user: CurrentUser, db: DbSession) -> Response:
    report = get_report(report_id, user, db)
    content, media_type, extension = _render_report(report.snapshot, report.format)
    filename = f"sandbox-report-{report.id}.{extension}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
