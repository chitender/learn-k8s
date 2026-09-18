from exam_catalog import EXAM_GUIDE, TASKS, CATALOGS, catalog_tasks

errors = []

for exam_type, guide in EXAM_GUIDE.items():
    competencies = {
        competency
        for domain in guide["domains"].values()
        for competency in domain["competencies"]
    }
    task_competencies = {task["competency"] for task in TASKS[exam_type].values()}
    missing = competencies - task_competencies
    if missing:
        errors.append(f"{exam_type}: competencies without tasks: {sorted(missing)}")

    catalog_task_ids = set()
    for catalog in CATALOGS[exam_type]:
        ids = catalog["tasks"]
        if len(ids) != len(set(ids)):
            errors.append(f"{catalog['id']}: duplicate task IDs")
        for task_id in ids:
            if task_id not in TASKS[exam_type]:
                errors.append(f"{catalog['id']}: unknown task {task_id}")
            catalog_task_ids.add(task_id)

        weighted = catalog_tasks(exam_type, catalog["id"])
        total = sum(task["weight"] for task in weighted)
        if total != 100:
            errors.append(f"{catalog['id']}: weights sum to {total}, expected 100")

        domains_in_form = {task["domain"] for task in weighted}
        expected_domains = set(guide["domains"])
        if domains_in_form != expected_domains:
            errors.append(
                f"{catalog['id']}: domains {sorted(domains_in_form)} do not match {sorted(expected_domains)}"
            )

    uncovered_tasks = set(TASKS[exam_type]) - catalog_task_ids
    if uncovered_tasks:
        errors.append(f"{exam_type}: tasks not used in any catalogue: {sorted(uncovered_tasks)}")

if errors:
    raise SystemExit("\n".join(errors))

print(
    "✓ Exam catalogues validated: "
    + ", ".join(f"{exam}={len(CATALOGS[exam])} forms/{len(TASKS[exam])} tasks" for exam in CATALOGS)
)
