import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'https://exp.host/--/api/v2/push/send',
  headers: {
    'Content-Type': 'application/json',
    'accept': 'application/json',
  },
});

/**
 * Sends a notification to a single recipient.
 * @param {Object} params - The parameters for sending notifications.
 * @param {string} params.token - The device token.
 * @param {Object} params.notificationData - The notification content.
 * @returns {Promise<Object>} - The result of the notification attempt.
 */
const sendNotification = async ({ token, notificationData }) => {
  const { title, body, data } = notificationData;
  try {
    const response = await axiosInstance.post('', {
      to: token,
      title,
      body,
      data,
      priority: 'high'
    });

    console.log("Notification sent successfully:", response.data);
    return { success: true, response: response.data };
  } catch (error) {
    console.error("Failed to send notification:", error);
    return { success: false, error: error.toString() };
  }
};

/**
 * Lambda handler to process an event containing arrays of notifications.
 * @param {Array<Array>} event - An array of arrays, each containing notification requests.
 * @returns {Promise<Object>} - Summary of the notifications processed across all batches.
 */
export const handler = async (event) => {
  try {
    // Process each batch of notifications concurrently
    const batchResults = await Promise.allSettled(event.map(async (batch) => {
      const notificationPromises = batch.map(notification =>
        sendNotification(notification).catch(error => ({ success: false, error: error.toString() }))
      );
      const results = await Promise.allSettled(notificationPromises);

      const successes = results.filter(result => result.status === 'fulfilled' && result.value.success);
      const errors = results.filter(result => result.status === 'rejected' || !result.value.success);

      return {
        successes: successes.length,
        failures: errors.length
      };
    }));

    // Aggregate results from all batches
    const totalSuccesses = batchResults.reduce((total, batch) => total + batch.value.successes, 0);
    const totalFailures = batchResults.reduce((total, batch) => total + batch.value.failures, 0);

    // Log overall results
    if (totalFailures > 0) {
      console.error("Some notifications failed to send in some batches:", batchResults);
      return { status: 'Partial Success', totalSuccesses, totalFailures, batchResults };
    }

    console.log("All notifications sent successfully in all batches:", totalSuccesses);
    return { status: 'Success', totalNotificationsSent: totalSuccesses, batchResults };
  } catch (err) {
    console.error("Unexpected error in processing notifications:", err);
    return { status: 'Failed', error: err.toString() };
  }
};
