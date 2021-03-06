import * as React from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import {
  ActionGroup,
  Breadcrumb,
  BreadcrumbItem,
  Button,
  ButtonVariant,
  Dropdown,
  DropdownItem,
  DropdownPosition,
  DropdownToggle,
  Form,
  FormGroup,
  Modal,
  Text,
  TextInput,
  TextVariants,
  Toolbar,
  ToolbarSection
} from '@patternfly/react-core';
import { style } from 'typestyle';
import { PfColors } from '../../../../components/Pf/PfColors';
import * as API from '../../../../services/Api';
import * as AlertUtils from '../../../../utils/AlertUtils';
import { ThreeScaleHandler, ThreeScaleInfo } from '../../../../types/ThreeScale';
import { RenderContent } from '../../../../components/Nav/Page';
import history from '../../../../app/History';
import RefreshButtonContainer from '../../../../components/Refresh/RefreshButton';

// Properties handled by the component/page
// Note that ThreeScaleHandlerDetailsPage uses a RouteComponentProps<Props> used to capture the parameters in the route
// As this page can work for create a new handler or edit an existing handler, when handlerName is undefined the page
// take the scenario that is a "new handler" case.
interface Props {
  handlerName: string;
}

// State of the the component/page.
// It stores the visual state of the controllers and the handler edited/created.
interface State {
  isNew: boolean;
  isModified: boolean;
  threeScaleInfo: ThreeScaleInfo;
  handler: ThreeScaleHandler;
  dropdownOpen: boolean;
  deleteModalOpen: boolean;
}

// Style constants
const containerPadding = style({ padding: '20px 20px 20px 20px' });
const containerWhite = style({ backgroundColor: PfColors.White });
const paddingLeft = style({ paddingLeft: '20px' });
const rightToolbar = style({ marginLeft: 'auto' });

// Kubernetes ID validation helper, used to allow mark a warning in the form edition
const k8sRegExpName = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[-a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
const isValidK8SName = (name: string) => {
  return name === '' ? false : name.search(k8sRegExpName) === 0;
};

class ThreeScaleHandlerDetailsPage extends React.Component<RouteComponentProps<Props>, State> {
  constructor(props: RouteComponentProps<Props>) {
    super(props);
    this.state = {
      isNew: true,
      isModified: false,
      threeScaleInfo: {
        enabled: false,
        permissions: {
          create: false,
          update: false,
          delete: false
        }
      },
      handler: {
        name: '',
        serviceId: '',
        systemUrl: '',
        accessToken: ''
      },
      dropdownOpen: false,
      deleteModalOpen: false
    };
  }

  // It fetches the information about Threescale adapter (adapter detected at runtime, permissions).
  // It fetches the specific handler to edit. It ignores handler when creating a new Threescale handler.
  fetchHandler = (handlerName: string | undefined) => {
    API.getThreeScaleInfo()
      .then(result => {
        const threeScaleInfo = result.data;
        if (threeScaleInfo.enabled) {
          if (handlerName) {
            API.getThreeScaleHandlers()
              .then(results => {
                let handler: ThreeScaleHandler | undefined = undefined;
                for (let i = 0; results.data.length; i++) {
                  if (results.data[i].name === handlerName) {
                    handler = results.data[i];
                    break;
                  }
                }
                if (handler) {
                  this.setState({
                    isNew: false,
                    threeScaleInfo: threeScaleInfo,
                    handler: handler
                  });
                } else {
                  AlertUtils.addError('Could not fetch ThreeScaleHandler ' + handlerName + '.');
                }
              })
              .catch(error => {
                AlertUtils.addError('Could not fetch ThreeScaleHandlers.', error);
              });
          } else {
            this.setState({
              threeScaleInfo: threeScaleInfo
            });
          }
        } else {
          AlertUtils.addError('Kiali has 3scale extension enabled but 3scale adapter is not detected in the cluster');
        }
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch ThreeScaleInfo.', error);
      });
  };

  // It invokes backend when component is mounted
  componentDidMount() {
    this.fetchHandler(this.props.match.params.handlerName);
  }

  // This is a simplified actions toolbar.
  // It contains a delete action and invokes a confirmation modal.
  actionsToolbar = () => {
    return (
      <>
        <Dropdown
          id="actions"
          title="Actions"
          toggle={
            <DropdownToggle onToggle={(toggle: boolean) => this.setState({ dropdownOpen: toggle })}>
              Actions
            </DropdownToggle>
          }
          onSelect={() => this.setState({ dropdownOpen: !this.state.dropdownOpen })}
          position={DropdownPosition.right}
          isOpen={this.state.dropdownOpen}
          dropdownItems={[
            <DropdownItem key="createIstioConfig" onClick={() => this.setState({ deleteModalOpen: true })}>
              Delete
            </DropdownItem>
          ]}
        />
        <Modal
          title="Confirm Delete"
          isSmall={true}
          isOpen={this.state.deleteModalOpen}
          onClose={() => this.setState({ deleteModalOpen: false })}
          actions={[
            <Button key="cancel" variant="secondary" onClick={() => this.setState({ deleteModalOpen: false })}>
              Cancel
            </Button>,
            <Button key="confirm" variant="danger" onClick={() => this.deleteHandler()}>
              Delete
            </Button>
          ]}
        >
          <Text component={TextVariants.p}>
            Are you sure you want to delete the 3scale Handler '{this.props.match.params.handlerName}'? It cannot be
            undone. Make sure this is something you really want to do!
          </Text>
        </Modal>
      </>
    );
  };

  // Check if user has permission to write Threescale objects (under the hood it checks if user can write on control plane namespace)
  canDelete = (): boolean => {
    return this.state.threeScaleInfo.enabled && this.state.threeScaleInfo.permissions.delete;
  };

  canUpdate = (): boolean => {
    return (
      this.state.threeScaleInfo.enabled &&
      this.state.threeScaleInfo.permissions.create &&
      this.state.threeScaleInfo.permissions.update
    );
  };

  // This is a simplified toolbar for refresh and actions.
  // Kiali has a shared component toolbar for more complex scenarios like filtering
  // It renders actions only if user has permissions
  toolbar = () => {
    return (
      <Toolbar className="pf-l-toolbar pf-u-justify-content-space-between pf-u-mx-xl pf-u-my-md">
        <ToolbarSection aria-label="ToolbarSection">
          <Toolbar className={rightToolbar}>
            <RefreshButtonContainer
              key={'Refresh'}
              handleRefresh={() => this.fetchHandler(this.props.match.params.handlerName)}
            />
            {this.canDelete() && this.actionsToolbar()}
          </Toolbar>
        </ToolbarSection>
      </Toolbar>
    );
  };

  // Page title on 3scale extension doesn't have a namespace
  // 3scale entities are always located under the control plane namespace, but that's implicit in the domain
  pageTitle = (title: string) => (
    <>
      <div className={`breadcrumb ${containerWhite} ${paddingLeft}`}>
        <Breadcrumb>
          <BreadcrumbItem>
            <Link to={'/extensions/threescale'}>3scale Handlers</Link>
          </BreadcrumbItem>
          <BreadcrumbItem isActive={true}>{title}</BreadcrumbItem>
        </Breadcrumb>
        <Text component={TextVariants.h1}>{title}</Text>
        {!this.state.isNew && this.toolbar()}
      </div>
    </>
  );

  // Invoke the history object to update and URL and start a routing
  goHandlersPage = () => {
    history.push('/extensions/threescale');
  };

  // Basic form validation for new and updates
  isValid = () => {
    return (
      this.state.handler.name !== '' &&
      this.state.handler.serviceId !== '' &&
      this.state.handler.systemUrl !== '' &&
      this.state.handler.accessToken !== ''
    );
  };

  // Updates state with modifications of the new/editing handler
  changeHandler = (field: string, value: string) => {
    this.setState(prevState => {
      const newThreeScaleHandler = prevState.handler;
      switch (field) {
        case 'handlerName':
          newThreeScaleHandler.name = value.trim();
          break;
        case 'serviceId':
          newThreeScaleHandler.serviceId = value.trim();
          break;
        case 'accessToken':
          newThreeScaleHandler.accessToken = value.trim();
          break;
        case 'systemUrl':
          newThreeScaleHandler.systemUrl = value.trim();
          break;
        default:
      }
      return {
        isNew: prevState.isNew,
        isModified: true,
        handler: newThreeScaleHandler
      };
    });
  };

  // It invokes backend to create/update a 3scale handler
  updateHandler = () => {
    if (this.state.isNew) {
      API.createThreeScaleHandler(JSON.stringify(this.state.handler))
        .then(_ => this.goHandlersPage())
        .catch(error => AlertUtils.addError('Could not create ThreeScaleHandlers.', error));
    } else {
      API.updateThreeScaleHandler(this.state.handler.name, JSON.stringify(this.state.handler))
        .then(_ => this.goHandlersPage())
        .catch(error => AlertUtils.addError('Could not update ThreeScaleHandlers.', error));
    }
  };

  // It invokes backend to delete a 3scale handler
  deleteHandler = () => {
    API.deleteThreeScaleHandler(this.state.handler.name)
      .then(_ => this.goHandlersPage())
      .catch(error => AlertUtils.addError('Could not delete ThreeScaleHandlers.', error));
  };

  render() {
    const title = this.props.match.params.handlerName
      ? this.props.match.params.handlerName
      : 'Create New 3scale Handler';
    return (
      <>
        {this.pageTitle(title)}
        <RenderContent>
          <div className={containerPadding}>
            <Form isHorizontal={true}>
              <FormGroup
                fieldId="handlerName"
                label="Handler Name:"
                isValid={isValidK8SName(this.state.handler.name)}
                helperTextInvalid="Name must consist of lower case alphanumeric characters, '-' or '.', and must start and end with an alphanumeric character."
              >
                <TextInput
                  id="handlerName"
                  value={this.state.handler.name}
                  placeholder="3scale Handler Name"
                  onChange={value => this.changeHandler('handlerName', value)}
                  isDisabled={!this.state.isNew}
                />
              </FormGroup>
              <FormGroup
                fieldId="serviceId"
                label="Service Id:"
                isValid={this.state.handler.serviceId !== ''}
                helperTextInvalid="Service Id cannot be empty"
              >
                <TextInput
                  id="serviceId"
                  value={this.state.handler.serviceId}
                  placeholder="3scale ID for API calls"
                  onChange={value => this.changeHandler('serviceId', value)}
                />
              </FormGroup>
              <FormGroup
                fieldId="systemUrl"
                label="System Url:"
                isValid={this.state.handler.systemUrl !== ''}
                helperTextInvalid="System Url cannot be empty"
              >
                <TextInput
                  id="systemUrl"
                  value={this.state.handler.systemUrl}
                  placeholder="3scale System Url for API"
                  onChange={value => this.changeHandler('systemUrl', value)}
                />
              </FormGroup>
              <FormGroup
                fieldId="accessToken"
                label="Access Token:"
                isValid={this.state.handler.accessToken !== ''}
                helperTextInvalid="Access Token cannot be empty"
              >
                <TextInput
                  id="accessToken"
                  value={this.state.handler.accessToken}
                  placeholder="3scale access token"
                  onChange={value => this.changeHandler('accessToken', value)}
                />
              </FormGroup>
              <ActionGroup>
                <span style={{ float: 'left', paddingTop: '10px', paddingBottom: '10px' }}>
                  <span style={{ paddingRight: '5px' }}>
                    <Button
                      variant={ButtonVariant.primary}
                      isDisabled={!this.canUpdate() || !this.isValid()}
                      onClick={this.updateHandler}
                    >
                      {this.state.isNew ? 'Create' : 'Save'}
                    </Button>
                  </span>
                  <span style={{ paddingRight: '5px' }}>
                    <Button
                      variant={ButtonVariant.secondary}
                      onClick={() => {
                        this.goHandlersPage();
                      }}
                    >
                      Cancel
                    </Button>
                  </span>
                </span>
              </ActionGroup>
              <>
                Notes:
                <br />
                Changes in a 3scale handler will affect to all linked services.
              </>
            </Form>
          </div>
        </RenderContent>
      </>
    );
  }
}

export default ThreeScaleHandlerDetailsPage;
