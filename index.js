const core = require('@actions/core');
const github = require('@actions/github');

const getPullRequestNumber = (ref) => {
  core.debug(`Parsing ref: ${ref}`);
  // This assumes that the ref is in the form of `refs/pull/:prNumber/merge`
  const prNumber = ref.replace(/refs\/pull\/(\d+)\/merge/, '$1');
  return parseInt(prNumber, 10);
};

(async () => {
  try {
    const owner = github.context.repo.owner;
    const repo = github.context.repo.repo;
    const ref = github.context.ref;
    const prNumber = github.context.issue.number || getPullRequestNumber(ref);
    const gitHubToken = core.getInput('github-token', { required: true });
    const octokit = new github.getOctokit(gitHubToken);

    const getPrLabels = async (prNumber) => {
      const { data } = await octokit.pulls.get({
        pull_number: prNumber,
        owner,
        repo,
      });
      if (data.length === 0) {
        throw new Error(`No Pull Requests found for ${prNumber} (${ref}).`);
      }
      return data.labels.map((label) => label.name);
    };

    const prLabels = await getPrLabels(prNumber);
    core.debug(`Found PR labels: ${prLabels.toString()}`);

    const reviews = await octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
    });
    const allReviewsFromActionsBot = reviews.data.filter(
      (review) => review.user.login === 'github-actions[bot]'
    );
    const lastReviewFromActionsBot =
      allReviewsFromActionsBot.length > 0 &&
      allReviewsFromActionsBot[allReviewsFromActionsBot.length - 1];
    core.debug(
      `Last review from actions bot: ${JSON.stringify(
        lastReviewFromActionsBot
      )}`
    );

    if (prLabels.length > 0) {
      core.info(`Pull Request has at least a label. All good!`);
      if (
        lastReviewFromActionsBot &&
        lastReviewFromActionsBot.state !== 'DISMISSED'
      ) {
        await octokit.pulls.dismissReview({
          owner,
          repo,
          pull_number: prNumber,
          review_id: lastReviewFromActionsBot.id,
          message: 'All good!',
        });
      }
      return;
    }

    if (
      lastReviewFromActionsBot &&
      lastReviewFromActionsBot.state === 'CHANGES_REQUESTED'
    ) {
      core.info(`Skipping REQUEST_CHANGES review`);
      return;
    }

    const reviewMessage = `👋 Hi,
this is a reminder message for maintainers to assign a proper label to this Pull Request.

The bot will dismiss the review as soon as at least one label has been assigned to the Pull Request.
Thanks.`;
    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      body: reviewMessage,
      event: 'REQUEST_CHANGES',
    });
  } catch (error) {
    await core.setFailed(error.stack || error.message);
  }
})();
