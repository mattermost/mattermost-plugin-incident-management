# Telemetry

We only track the events that create, delete, or update items. We never track the specific content of the items. In particular, we do not collect the name of the incidents or the contents of the stages and steps.

Every event we track is accompanied with metadata that help us identify each event and isolate it from the rest of the servers. We can group all events that are coming from a single server, and if that server is licensed, we are able to identify the buyer of the license. The following list details the metadata that accompanies every event:

- `diagnosticID`: Unique identifier of the server the plugin is running on.
- `serverVersion`: Version of the server the plugin is running on.
- `pluginVersion`: Version of the plugin.
- `eventTimeStamp`: Timestamp indicating when the event was queued to send to the server.
- `createdAt`: Timestamp indicating when the event was sent to the server.
- `id`: Unique identifier of the event.
- `event integrations`: Unused field. It always contains the value `null`.
- `event originalTimestamp`: Timestamp indicating when the event actually happened. It always equals `eventTimeStamp`.
- `type`: Type of the event. It always contains the string `track`.

**Events data**

| Event  | Triggers   |  Information collected |  
|--------|------------|------------------------|
| Incident created  | Any user sends the `/incident start` command and creates an incident.</br><br> Any user clicks on the **+** button on the **Incident List** view, in the RHS and creates an incident.</br><br>Any user clicks on the drop-down menu of any post, clicks on the **Start incident** option, and creates an incident. | `ID`: Unique identifier of the incident.</br><br>`IsActive`: Boolean  value indicating if the incident is active. It always equals `true`.</br><br>`CommanderUserID`: Unique identifier of the commander of the incident. It equals the identifier of the user that created the incident.</br><br>`TeamID`: Unique identifier of the team where the incident channel is created.</br><br>`CreatedAt`: Timestamp of the incident creation.</br><br>`ChannelIDs`: A list containing a single element, the channel created along with the incident.</br><br>`PostID`: Unique identifier of the post.</br><br>`NumChecklists`: Number of checklists. It always equals 1.</br><br>`TotalChecklistItems`: Number of checklist items this incident starts with. It always equals 0.</br><br>`ID`: Unique identifier of the incident.</br><br>`IsActive`: Boolean value indicating if the incident is active. It always equals `true`.</br><br>`CommanderUserID`: Unique identifier of the commander of the incident. It equals the identifier of the user that created the incident.</br><br>`TeamID`: Unique identifier of the team where the incident channel is created.</br><br>`CreatedAt`: Timestamp of the incident creation.</br><br>`ChannelIDs`: A list containing a single element, the channel created along with the incident.</br><br>`PostID`: Unique identifier of the post.</br><br>`NumChecklists`: Number of checklists. It always equals 1.</br><br>`TotalChecklistItems`: Number of checklist items this incident starts with. It always equals 0. |   
| Incident finished | Any user sends the `/incident end` command.</br><br> Any user clicks on the **End Incident** button through the incident details view, in the RHS. | `ID`: Unique identifier of the incident.</br><br>`IsActive`: Boolean  value indicating if the incident is active. It always equals ``false``.</br><br>`CommanderUserID`: Unique identifier of the commander of the incident. It equals the identifier of the user that created the incident.</br><br>`UserID`: Unique identifier of user that ended the incident.</br><br>`TeamID`: Unique identifier of the team where the incident channel is created.</br><br>`CreatedAt`: Timestamp of the incident creation.</br><br>`ChannelIDs`: A list containing a single element, the channel created along with the incident.</br><br>`PostID`: Unique identifier of the post.</br><br>`NumChecklists`: Number of checklists. It always equals 1.</br><br>`TotalChecklistItems`: Number of checklist items this incident starts with. It always equals 0. |  
| Checklist item created | Any user creates a new checklist item through the incident details view, in the RHS. | `IncidentID`: Unique identifier of the incident where the item was created.</br><br>`UserID`: Unique identifier of the user that created the item. |    
| Checklist item removed | Any user deletes a checklist item through the incident details view, in the RHS. | `IncidentID`: Unique identifier of the incident where the item was.</br><br>`UserID`: Unique identifier of the user that removed the item. |
| Checklist item renamed | Any user edit the contents of a checklist item through the incident details view, in the RHS. | `IncidentID`: Unique identifier of the incident where the item was.</br><br>`UserID`: Unique identifier of the user that removed the item. |
| Checklist item moved | Any user moves the position of a checklist item in the list through the incident details view, in the RHS. | `IncidentID`: Unique identifier of the incident where the item is.</br><br>`UserID`: Unique identifier of the user that edited the item. |
| Unchecked checklist item checked | Any user checks an unchecked checklist item through the incident details view, in the RHS. | `IncidentID`: Unique identifier of the incident where the item is.</br><br>`UserID`: Unique identifier of the user that checked the item. |
| Checked checklist item unchecked | Any user unchecks a checked checklist item through the incident details view, in the RHS. | `IncidentID`: Unique identifier of the incident where the item is.</br><br>`UserID`: Unique identifier of the user that unchecked the item. |
| Playbook created | Any user clicks on the **+ New Playbook** button on the backstage and saves it. | `PlaybookID`: Unique identifier of the playbook.</br><br>`TeamID`: Unique identifier of the team where the playbook is created.</br><br>`NumChecklists`: Number of checklists this playbook has after the update.</br><br>`TotalChecklistItems`: Number of checklist items, among all checklists, this playbook has after the update. |
| Playbook deleted | Any user clicks on the **Delete** button next to a playbook on the backstage and confirms. | `PlaybookID`: Unique identifier of the playbook.</br><br>`TeamID`: Unique identifier of the team where the playbook was located.</br><br>`NumChecklists`: Number of checklists this playbook had immediately prior to deletion.</br><br>`TotalChecklistItems`: Number of checklist items, among all checklists, this playbook had immediately prior to deletion. |
| Restart incident |||
| Set assignee |||
| Update playbook|||
| Change commander |||
| Change stage|||
| Run checklist item slash command |||
