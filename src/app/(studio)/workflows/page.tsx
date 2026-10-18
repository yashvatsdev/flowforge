import { NewWorkflowButton, WorkflowList } from "@/components/workflow-list";
export default function Page() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE SYSTEMS YOU’RE BUILDING.</span>
          <h1>
            Workflows<span className="accent">.</span>
          </h1>
          <p>A home for every process you want to put in motion.</p>
        </div>
        <NewWorkflowButton />
      </div>
      <div className="panel">
        <WorkflowList />
      </div>
      <p className="page-footnote">
        Active workflows are ready to run manually. This demo does not schedule
        background jobs.
      </p>
    </>
  );
}
